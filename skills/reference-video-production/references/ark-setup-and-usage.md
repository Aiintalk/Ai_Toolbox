# 火山方舟接入与使用

本 Skill 自带 `scripts/ark.py`，调用官方火山方舟生成接口与私域虚拟人像库接口；无需安装 Hypit Skill。以下命令在本 Skill 目录运行。Python 3、网络和实际账号权限仍是运行条件。

## 首次配置

1. `python3 scripts/setup.py`：在用户目录建立独立 Python 环境并安装 `keyring`、官方 TOS Python SDK `tos` 与 FFmpeg 执行器 `imageio-ffmpeg`。Windows 可用 `python`。
2. `python3 scripts/run.py configure --all`：交互输入方舟视频生成 API Key、Access Key ID、Secret Access Key。输入不显示，保存在本机系统凭据库；也可用环境变量 `ARK_API_KEY`、`VOLC_ACCESS_KEY_ID`、`VOLC_SECRET_ACCESS_KEY`，但不要写入项目或提交版本控制。
3. `python3 scripts/run.py status`：仅检查三个凭据是否存在，不读取或输出密钥值，不访问网络。

视频裁切、转码、拼接与混音可用 `python3 scripts/run.py ffmpeg <FFmpeg参数>`。执行器随首次配置安装，无需另外安装 Hypit 或系统 FFmpeg；带时间码转写仍需另有可用能力或由 Codex 对音频进行核对。

视频生成接口使用 API Key；素材库管理使用 AK/SK。Key 不会自动开通模型、素材库、IAM 项目或额度。首次创建素材组前，账号可能需在控制台完成素材库开通与授权函。API Key 所属项目、素材组与素材资产的 `ProjectName` 要一致。

## 上传与调用虚拟素材库

先查看已有素材：

- `python3 scripts/run.py groups --project default`
- `python3 scripts/run.py assets --project default --group-id group-...`

新建虚拟人像素材组：

- `python3 scripts/run.py group-create --name 我的虚拟人物 --project default`

上传现有 HTTPS 链接：

- `python3 scripts/run.py asset-create --group-id group-... --type Image --url https://example.com/person.png --project default`

上传本地文件：

- `python3 scripts/run.py asset-create --group-id group-... --type Video --file /absolute/path/clip.mp4 --bucket YOUR_CN_BEIJING_TOS_BUCKET --project default`

本地文件先上传到使用者已有的北京 TOS 桶，再用有效的临时签名链接调用 `CreateAsset`。AK/SK 同时要有该桶的上传与签名权限。素材源 URL 不输出到终端，因为签名链接包含临时访问凭据。工具不会创建或公开存储桶。

`CreateAsset` 是异步处理。获得 `asset-...` 后运行：

- `python3 scripts/run.py asset-wait asset-... --project default`

仅当 `Status=Active` 才可在生成请求中使用 `asset://asset-...`。`Failed` 时查看返回的 `Error`。在提示词里使用“图片1、视频1、音频1”等顺序指代，而不是直接写资产 ID。

## 提交 Seedance 2.0

为每个需要改变的短镜头写一个 JSON 文件，例如：

```json
{
  "prompt": "图片1中的虚拟人物保持身份、服装和动作，背景换为轻医美咨询间。准确说出：示例台词。声音参考音频1，语速与参考一致，口型对应中文发音。",
  "duration": 5,
  "resolution": "720p",
  "project": "default",
  "ratio": "9:16",
  "generate_audio": true,
  "references": [
    {"type": "image", "url": "asset://asset-EXAMPLE"},
    {"type": "audio", "url": "https://example.com/voice.mp3"}
  ]
}
```

把示例 URL 与 ID 换成真实素材。`resolution` 不写时默认 720p；模型固定为官方 Seedance 2.0 `doubao-seedance-2-0-260128`。所有 `asset://` 引用须为 `project` 所指项目下已激活素材；提交前工具会逐个核对状态、项目和素材类型。`project` 用于素材核对，不是视频生成接口的独立参数；API Key 本身须归属同一项目。

执行：

1. `python3 scripts/run.py generate --spec /absolute/path/shot01.json --dry-run`：本地检查格式与参数，不产生费用。
2. `python3 scripts/run.py generate --spec /absolute/path/shot01.json`：提交一次生成，并立即写入同名 `.receipt.json`，避免中断后重复提交。
3. `python3 scripts/run.py task-wait cgt-... --output /absolute/path/shot01.mp4`：等待并下载实际结果。中断后用同一任务 ID 继续查询，不重新提交。

接口接受的是短片段。长视频应保留原片时间码、镜头表、统一角色/声音资产 ID，逐段提交，再用视频工具拼接与质检完整 MP4。精确声音、动作与口型不是 API Key 或提示词能保证的；必须验收实际片段。

## 官方接口依据

- [Seedance 2.0 教程](https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh)
- [创建视频生成任务](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)
- [私域虚拟人像库使用指南](https://docs.volcengine.com/docs/ark/private-virtual-avatar-library-guide-preview?lang=zh)
- [查询素材状态](https://docs.volcengine.com/docs/ark/get-asset-api?lang=zh)
- [火山 TOS Python SDK](https://github.com/volcengine/ve-tos-python-sdk)
