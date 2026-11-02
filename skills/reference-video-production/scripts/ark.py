#!/usr/bin/env python3
"""Ark Seedance 2.0 and private AIGC asset library client.

No credential is stored in a Skill file, project file, command argument or log.
"""
import argparse
import datetime as dt
import getpass
import hashlib
import hmac
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

SERVICE = "reference-video-production-ark"
ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3"
ASSET_HOST = "ark.cn-beijing.volcengineapi.com"
MODEL = "doubao-seedance-2-0-260128"


def secret(name, required=True):
    env_names = {"api_key": "ARK_API_KEY", "ak": "VOLC_ACCESS_KEY_ID", "sk": "VOLC_SECRET_ACCESS_KEY"}
    value = os.getenv(env_names[name])
    if value:
        return value
    try:
        import keyring
        value = keyring.get_password(SERVICE, name)
    except ImportError:
        value = None
    except Exception as e:
        raise RuntimeError("系统凭据库不可用；请配置系统 Keychain/Credential Locker，或使用环境变量。") from e
    if required and not value:
        raise ValueError(f"缺少 {name}。请先运行 configure，或设置 {env_names[name]} 环境变量。")
    return value


def configure(args):
    try:
        import keyring
    except ImportError as e:
        raise RuntimeError("请先运行 python scripts/setup.py 安装本 Skill 的运行依赖。") from e
    selected = ["api_key", "ak", "sk"] if args.all else [args.kind]
    for name in selected:
        value = getpass.getpass(f"输入 {name}（不显示）：").strip()
        if not value:
            raise ValueError(f"{name} 为空，未保存。")
        try:
            keyring.set_password(SERVICE, name, value)
        except Exception as e:
            raise RuntimeError("系统凭据库不可用；请配置系统 Keychain/Credential Locker，或使用环境变量。") from e
        print(f"已保存 {name} 至系统凭据库。")


def http_json(url, payload=None, headers=None, method=None, timeout=60):
    body = None if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = Request(url, data=body, headers=headers or {}, method=method or ("POST" if body else "GET"))
    try:
        with urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:1200]
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e
    except URLError as e:
        raise RuntimeError(f"网络请求失败：{e.reason}") from e


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def mac(key, value):
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).digest()


def asset_call(action, data):
    ak, sk = secret("ak"), secret("sk")
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    day = now[:8]
    query = f"Action={quote(action, safe='-_.~')}&Version=2024-01-01"
    digest = sha256(body)
    signed = "content-type;host;x-content-sha256;x-date"
    canonical_headers = f"content-type:application/json\nhost:{ASSET_HOST}\nx-content-sha256:{digest}\nx-date:{now}\n"
    canonical = "\n".join(["POST", "/", query, canonical_headers, signed, digest])
    scope = f"{day}/cn-beijing/ark/request"
    sign_text = "\n".join(["HMAC-SHA256", now, scope, sha256(canonical.encode("utf-8"))])
    key = mac(mac(mac(mac(sk.encode("utf-8"), day), "cn-beijing"), "ark"), "request")
    signature = hmac.new(key, sign_text.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "Content-Type": "application/json",
        "X-Date": now,
        "X-Content-Sha256": digest,
        "Authorization": f"HMAC-SHA256 Credential={ak}/{scope}, SignedHeaders={signed}, Signature={signature}",
    }
    result = http_json(f"https://{ASSET_HOST}/?{query}", data, headers)
    meta = result.get("ResponseMetadata") or {}
    if meta.get("Error"):
        raise RuntimeError(f"{action}: {json.dumps(meta['Error'], ensure_ascii=False)}")
    return result.get("Result", result)


def asset_list(args, groups=False):
    action = "ListAssetGroups" if groups else "ListAssets"
    filt = {"GroupType": "AIGC"}
    if args.name:
        filt["Name"] = args.name
    if not groups and args.group_id:
        filt["GroupIds"] = [args.group_id]
    token = None
    items = []
    while True:
        data = {"Filter": filt, "MaxResults": 100, "SortBy": "CreateTime", "SortOrder": "Desc", "ProjectName": args.project}
        if token:
            data["NextToken"] = token
        result = asset_call(action, data)
        items.extend(result.get("Items", []))
        token = result.get("NextToken")
        if not token:
            break
    for item in items:
        item.pop("URL", None)  # Temporary signed URLs are not needed for selection.
    return items


def upload_file(path, bucket, endpoint):
    try:
        import tos
    except ImportError as e:
        raise RuntimeError("本地文件上传需要 TOS SDK；运行 python scripts/setup.py。") from e
    path = Path(path).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    key = f"reference-video-production/{uuid4().hex}/{path.name}"
    client = tos.TosClientV2(secret("ak"), secret("sk"), endpoint, "cn-beijing")
    client.put_object_from_file(bucket, key, str(path))
    signed = client.pre_signed_url(tos.HttpMethodType.Http_Method_Get, bucket=bucket, key=key, expires=86400)
    return signed.signed_url, f"tos://{bucket}/{key}"


def create_asset(args):
    if bool(args.url) == bool(args.file):
        raise ValueError("--url 与 --file 恰好选择一个。")
    group = asset_call("GetAssetGroup", {"Id": args.group_id, "ProjectName": args.project})
    if group.get("GroupType") != "AIGC" or group.get("ProjectName") != args.project:
        raise ValueError("素材组不是当前项目的 AIGC 虚拟人像组。")
    source = args.url
    tos_uri = None
    if args.file:
        if not args.bucket:
            raise ValueError("本地文件上传还需要 --bucket（使用者自己的北京 TOS 存储桶）。")
        source, tos_uri = upload_file(args.file, args.bucket, args.tos_endpoint)
        print(json.dumps({"uploaded_to_tos": tos_uri}, ensure_ascii=False), flush=True)
    if not source.startswith("https://"):
        raise ValueError("素材来源必须是可访问的 HTTPS URL。")
    payload = {"GroupId": args.group_id, "URL": source, "AssetType": args.type, "ProjectName": args.project}
    if args.name:
        payload["Name"] = args.name
    result = asset_call("CreateAsset", payload)
    # Do not print the temporary signed URL.
    return {"asset_id": result.get("Id"), "status": "Processing", "tos_uri": tos_uri}


def get_asset(args):
    result = asset_call("GetAsset", {"Id": args.id, "ProjectName": args.project})
    result.pop("URL", None)
    return result


def wait_asset(args):
    deadline = time.monotonic() + args.timeout
    while True:
        result = get_asset(args)
        status = result.get("Status")
        if status in ("Active", "Failed"):
            return result
        if time.monotonic() >= deadline:
            raise TimeoutError(f"素材 {args.id} 仍在处理；稍后使用 asset-get 查看。")
        time.sleep(args.interval)


def validate_spec(spec):
    if not isinstance(spec, dict) or not isinstance(spec.get("prompt"), str) or not spec["prompt"].strip():
        raise ValueError("spec 必须有非空 prompt。")
    if spec.get("model", MODEL) != MODEL:
        raise ValueError("本客户端只支持 doubao-seedance-2-0-260128；不能静默更换模型。")
    duration = spec.get("duration")
    if not isinstance(duration, int) or isinstance(duration, bool) or not 4 <= duration <= 15:
        raise ValueError("Seedance 2.0 的 duration 必须为 4–15 秒整数。")
    if spec.get("resolution", "720p") not in ("480p", "720p", "1080p", "4k"):
        raise ValueError("resolution 无效。")
    if spec.get("ratio", "9:16") not in ("16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"):
        raise ValueError("ratio 无效。")
    if not isinstance(spec.get("generate_audio", True), bool) or not isinstance(spec.get("watermark", False), bool):
        raise ValueError("generate_audio 和 watermark 必须是布尔值。")
    refs = spec.get("references", [])
    if not isinstance(refs, list):
        raise ValueError("references 必须为数组。")
    content = [{"type": "text", "text": spec["prompt"]}]
    counts = {"image": 0, "video": 0, "audio": 0}
    for ref in refs:
        if not isinstance(ref, dict) or ref.get("type") not in counts:
            raise ValueError("reference.type 必须是 image、video 或 audio。")
        kind, url = ref["type"], ref.get("url", "")
        if not isinstance(url, str) or not (url.startswith("asset://asset-") or url.startswith("https://")):
            raise ValueError("reference.url 必须是 asset://asset-... 或 HTTPS URL。")
        counts[kind] += 1
        type_name = f"{kind}_url"
        content.append({"type": type_name, type_name: {"url": url}, "role": f"reference_{kind}"})
    if counts["image"] > 9 or counts["video"] > 3 or counts["audio"] > 3:
        raise ValueError("Seedance 2.0 参考素材数量超限。")
    if counts["audio"] and not (counts["image"] or counts["video"]):
        raise ValueError("Seedance 2.0 不能只传参考音频。")
    payload = {
        "model": MODEL,
        "content": content,
        "resolution": spec.get("resolution", "720p"),
        "ratio": spec.get("ratio", "9:16"),
        "duration": duration,
        "generate_audio": spec.get("generate_audio", True),
        "watermark": spec.get("watermark", False),
    }
    return payload


def task_get(task_id):
    if not task_id.startswith("cgt-"):
        raise ValueError("任务 ID 应以 cgt- 开头。")
    return http_json(f"{ARK_BASE}/contents/generations/tasks/{quote(task_id, safe='-')}", headers={"Authorization": f"Bearer {secret('api_key')}"})


def redacted_task(result):
    result = dict(result)
    content = result.get("content")
    if isinstance(content, dict):
        result["content"] = {k: ("<temporary URL hidden>" if k.endswith("_url") and v else v) for k, v in content.items()}
    return result


def download_video(url, path):
    if not url.startswith("https://"):
        raise ValueError("生成结果不是 HTTPS 下载地址。")
    path = Path(path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".part")
    try:
        with urlopen(url, timeout=120) as source, temp.open("wb") as output:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
        if temp.stat().st_size == 0:
            raise RuntimeError("下载结果为空。")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    return str(path)


def generate(args):
    spec_path = Path(args.spec).expanduser().resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    payload = validate_spec(spec)
    if args.dry_run:
        # URLs can contain signed tokens; print only roles and counts.
        return {"model": payload["model"], "resolution": payload["resolution"], "duration": payload["duration"], "ratio": payload["ratio"], "references": [c["role"] for c in payload["content"][1:]], "ready": bool(secret("api_key", False))}
    receipt = Path(args.receipt).expanduser().resolve() if args.receipt else spec_path.with_suffix(".receipt.json")
    if receipt.exists():
        raise FileExistsError(f"回执已存在：{receipt}。先查询已有任务，避免重复付费提交。")
    for item in payload["content"][1:]:
        url = item[item["type"]]["url"]
        if url.startswith("asset://"):
            asset = asset_call("GetAsset", {"Id": url[len("asset://"):], "ProjectName": spec.get("project", "default")})
            expected = {"image_url": "Image", "video_url": "Video", "audio_url": "Audio"}[item["type"]]
            if asset.get("Status") != "Active" or asset.get("ProjectName") != spec.get("project", "default") or asset.get("AssetType") != expected:
                raise ValueError(f"素材 {url} 尚未 Active、类型不匹配，或不属于请求项目。")
    result = http_json(f"{ARK_BASE}/contents/generations/tasks", payload, {"Authorization": f"Bearer {secret('api_key')}", "Content-Type": "application/json"})
    task_id = result.get("id")
    if not task_id:
        raise RuntimeError(f"接口未返回任务 ID：{json.dumps(result, ensure_ascii=False)[:600]}")
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.write_text(json.dumps({"task_id": task_id, "spec": str(spec_path), "model": MODEL, "resolution": payload["resolution"]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"task_id": task_id, "receipt": str(receipt)}, ensure_ascii=False), flush=True)
    if args.wait:
        return wait_task(argparse.Namespace(id=task_id, timeout=args.timeout, interval=args.interval, output=args.output))
    return None


def wait_task(args):
    deadline = time.monotonic() + args.timeout
    while True:
        result = task_get(args.id)
        status = result.get("status")
        if status == "succeeded":
            video_url = (result.get("content") or {}).get("video_url")
            output = download_video(video_url, args.output) if args.output else None
            return {"task_id": args.id, "status": status, "output": output, "resolution": result.get("resolution"), "duration": result.get("duration")}
        if status in ("failed", "expired", "cancelled"):
            return redacted_task(result)
        if time.monotonic() >= deadline:
            raise TimeoutError(f"任务 {args.id} 尚未完成；稍后用 task-wait 继续查询。")
        time.sleep(args.interval)


def parser():
    p = argparse.ArgumentParser(description="Seedance 2.0 与火山方舟虚拟素材库工具")
    sub = p.add_subparsers(dest="command", required=True)
    c = sub.add_parser("configure", help="交互式输入密钥并保存到系统凭据库")
    c.add_argument("kind", nargs="?", choices=["api_key", "ak", "sk"], default="api_key")
    c.add_argument("--all", action="store_true")
    sub.add_parser("status", help="本地检查密钥是否已设置，不访问服务")
    for command in ("groups", "assets"):
        x = sub.add_parser(command)
        x.add_argument("--project", default="default")
        x.add_argument("--name")
        if command == "assets":
            x.add_argument("--group-id")
    x = sub.add_parser("group-create")
    x.add_argument("--name", required=True)
    x.add_argument("--description", default="")
    x.add_argument("--project", default="default")
    x = sub.add_parser("asset-create")
    x.add_argument("--group-id", required=True)
    x.add_argument("--type", choices=["Image", "Video", "Audio"], required=True)
    x.add_argument("--url")
    x.add_argument("--file")
    x.add_argument("--bucket")
    x.add_argument("--tos-endpoint", default="tos-cn-beijing.volces.com")
    x.add_argument("--project", default="default")
    x.add_argument("--name")
    for command in ("asset-get", "asset-wait"):
        x = sub.add_parser(command)
        x.add_argument("id")
        x.add_argument("--project", default="default")
        if command == "asset-wait":
            x.add_argument("--timeout", type=int, default=1800)
            x.add_argument("--interval", type=int, default=15)
    x = sub.add_parser("generate")
    x.add_argument("--spec", required=True)
    x.add_argument("--receipt")
    x.add_argument("--dry-run", action="store_true")
    x.add_argument("--wait", action="store_true")
    x.add_argument("--timeout", type=int, default=3600)
    x.add_argument("--interval", type=int, default=15)
    x.add_argument("--output")
    x = sub.add_parser("task-get")
    x.add_argument("id")
    x = sub.add_parser("task-wait")
    x.add_argument("id")
    x.add_argument("--timeout", type=int, default=3600)
    x.add_argument("--interval", type=int, default=15)
    x.add_argument("--output")
    return p


def main():
    args = parser().parse_args()
    try:
        if args.command == "configure":
            configure(args)
            return
        if args.command == "status":
            result = {name: bool(secret(name, False)) for name in ("api_key", "ak", "sk")}
        elif args.command in ("groups", "assets"):
            result = asset_list(args, args.command == "groups")
        elif args.command == "group-create":
            result = asset_call("CreateAssetGroup", {"Name": args.name, "Description": args.description, "GroupType": "AIGC", "ProjectName": args.project})
        elif args.command == "asset-create":
            result = create_asset(args)
        elif args.command == "asset-get":
            result = get_asset(args)
        elif args.command == "asset-wait":
            result = wait_asset(args)
        elif args.command == "generate":
            result = generate(args)
        elif args.command == "task-get":
            result = redacted_task(task_get(args.id))
        elif args.command == "task-wait":
            result = wait_task(args)
        else:
            raise ValueError("未知命令")
        if result is not None:
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, RuntimeError, FileNotFoundError, FileExistsError, TimeoutError, OSError) as e:
        print(f"错误：{e}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
