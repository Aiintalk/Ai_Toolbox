#!/usr/bin/env bash
set -euo pipefail

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SKILL_ROOT}/split_only.config.env"
CHECK_ONLY=false

usage() {
  cat <<'USAGE'
用法：bash run_split_only.sh [配置文件路径] [--check-only] [--config 配置文件路径]
示例：
  bash run_split_only.sh
  bash run_split_only.sh --check-only
  bash run_split_only.sh --config /abs/path/split_only.config.env
USAGE
}

while [[ $# -gt 0 ]]; do
  arg="${1//$'\u00a0'/}"
  case "$arg" in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --config)
      shift
      if [[ $# -eq 0 ]]; then
        echo "错误：--config 需要跟一个配置文件路径"
        usage
        exit 1
      fi
      CONFIG_FILE="$1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      echo "错误：不支持的参数 $arg"
      usage
      exit 1
      ;;
    *)
      CONFIG_FILE="$1"
      shift
      ;;
  esac
done

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "错误：未找到配置文件 -> $CONFIG_FILE"
  echo "说明：请先复制并按实际路径修改 split_only.config.env"
  exit 1
fi

source "$CONFIG_FILE"

resolve_path() {
  local p="$1"
  local base_dir="$2"
  if [[ "$p" == /* ]]; then
    echo "$p"
  else
    echo "${base_dir%/}/$p"
  fi
}

LENS_ANALYSIS_PROJECT_ROOT="${LENS_ANALYSIS_PROJECT_ROOT:-$SKILL_ROOT}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [[ -z "${BACKEND_DIR:-}" ]]; then
  if [[ -d "${LENS_ANALYSIS_PROJECT_ROOT}/backend" ]]; then
    BACKEND_DIR="${LENS_ANALYSIS_PROJECT_ROOT}/backend"
  elif [[ -d "${SKILL_ROOT}/backend" ]]; then
    BACKEND_DIR="${SKILL_ROOT}/backend"
  elif [[ -d "${SKILL_ROOT}/project/backend" ]]; then
    BACKEND_DIR="${SKILL_ROOT}/project/backend"
  else
    BACKEND_DIR="${LENS_ANALYSIS_PROJECT_ROOT}/backend"
  fi
else
  BACKEND_DIR="$(resolve_path "$BACKEND_DIR" "$LENS_ANALYSIS_PROJECT_ROOT")"
fi

BACKEND_DIR="$(resolve_path "$BACKEND_DIR" "$LENS_ANALYSIS_PROJECT_ROOT")"
BACKEND_VENV_DIR="${BACKEND_VENV_DIR:-backend/.venv}"
BACKEND_VENV_DIR="$(resolve_path "$BACKEND_VENV_DIR" "$LENS_ANALYSIS_PROJECT_ROOT")"
INPUT_VIDEO_DIR="$(resolve_path "${INPUT_VIDEO_DIR:-storage/raw_videos}" "$LENS_ANALYSIS_PROJECT_ROOT")"
SPLIT_OUTPUT_ROOT="$(resolve_path "${SPLIT_OUTPUT_ROOT:-storage/media/finished_split_only}" "$LENS_ANALYSIS_PROJECT_ROOT")"
SPLIT_LOG_DIR="$(resolve_path "${SPLIT_LOG_DIR:-storage/logs/shot_split_only}" "$LENS_ANALYSIS_PROJECT_ROOT")"
SCAN_CONFIG_PATH="$(resolve_path "${SCAN_CONFIG_PATH:-config/shot_detection.yaml}" "$LENS_ANALYSIS_PROJECT_ROOT")"
FINAL_CONFIG_PATH="$(resolve_path "${FINAL_CONFIG_PATH:-config/final_shot_split_only.yaml}" "$LENS_ANALYSIS_PROJECT_ROOT")"
WITH_CLIPS="${WITH_CLIPS:-true}"
FORCE_RESCAN="${FORCE_RESCAN:-false}"
FORCE_FINAL_REBUILD="${FORCE_FINAL_REBUILD:-false}"
VIDEO_ID="${VIDEO_ID:-}"
QWEN_API_KEY="${QWEN_API_KEY:-}"
QWEN_API_KEY_ENV_NAME="${QWEN_API_KEY_ENV_NAME:-QWEN_API_KEY}"
AUTO_INSTALL_TOOLS="${AUTO_INSTALL_TOOLS:-true}"

log_info() { printf '[INFO] %s\n' "$1"; }
log_ok() { printf '[OK] %s\n' "$1"; }
log_warn() { printf '[WARN] %s\n' "$1"; }
log_error() { printf '[ERROR] %s\n' "$1"; }

ensure_cli_entrypoint() {
  local entry_file="$BACKEND_DIR/app/cli/main.py"
  local entry_dir
  entry_dir="$(dirname "$entry_file")"

  if [[ -f "$entry_file" ]]; then
    return 0
  fi
  if [[ ! -d "$entry_dir" ]]; then
    log_error "CLI 入口目录不存在：$entry_dir"
    return 1
  fi

  log_warn "缺少 CLI 入口文件，正在自动补齐：$entry_file"
  cat > "$entry_file" <<'PYENTRY'
from app.cli.commands import main


if __name__ == "__main__":
    main()
PYENTRY
  log_ok "CLI 入口文件已补齐"
}

is_valid_env_name() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

looks_like_qwen_api_key() {
  local value="$1"
  [[ -n "$value" && "$value" == sk-* && ${#value} -ge 20 ]]
}

run_as_root() {
  local cmd=("$@")
  if command -v sudo >/dev/null 2>&1; then
    sudo "${cmd[@]}"
  else
    "${cmd[@]}"
  fi
}

normalize_tool_name() {
  local tool="$1"
  if [[ "$tool" == /* ]]; then
    tool="$(basename "$tool")"
  fi
  case "$tool" in
    python|python3|python3.10|python3.11|python3.12)
      echo "python3"
      ;;
    *)
      echo "$tool"
      ;;
  esac
}

install_system_tool() {
  local tool="$1"
  local pkg
  pkg="$(normalize_tool_name "$tool")"

  if [[ "${AUTO_INSTALL_TOOLS}" != "true" ]]; then
    return 1
  fi

  log_info "未检测到 $tool，尝试自动安装"

  if command -v brew >/dev/null 2>&1; then
    if [[ "$pkg" == "python3" ]]; then
      pkg="python@3.11"
    fi
    if ! brew install "$pkg"; then
      log_error "brew 安装失败：$pkg"
      return 1
    fi
    log_ok "已通过 brew 安装：$pkg"
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    if ! run_as_root apt-get update; then
      log_error "apt-get update 失败"
      return 1
    fi
    if ! run_as_root apt-get install -y "$pkg"; then
      log_error "apt-get 安装失败：$pkg"
      return 1
    fi
    log_ok "已通过 apt 安装：$pkg"
    return 0
  fi

  if command -v yum >/dev/null 2>&1; then
    if ! run_as_root yum install -y "$pkg"; then
      log_error "yum 安装失败：$pkg"
      return 1
    fi
    log_ok "已通过 yum 安装：$pkg"
    return 0
  fi

  if command -v dnf >/dev/null 2>&1; then
    if ! run_as_root dnf install -y "$pkg"; then
      log_error "dnf 安装失败：$pkg"
      return 1
    fi
    log_ok "已通过 dnf 安装：$pkg"
    return 0
  fi

  log_error "未识别可用包管理器，无法自动安装 $tool"
  return 1
}

need_command() {
  local cmd="$1"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_warn "命令不存在：$cmd。尝试自动安装。"
    if ! install_system_tool "$cmd"; then
      log_error "命令不存在：$cmd。请先手动安装。"
      return 1
    fi
    if ! command -v "$cmd" >/dev/null 2>&1; then
      if [[ "$cmd" == python* ]] && command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="$(command -v python3)"
        log_ok "已检测到替代 Python：$PYTHON_BIN"
        return 0
      fi
      log_error "安装后仍未找到：$cmd"
      return 1
    fi
  fi

  log_ok "$cmd 已检测：$(command -v "$cmd")"
  if [[ "$cmd" == "python3" ]]; then
    PYTHON_BIN="$(command -v "$cmd")"
  fi
  return 0
}

run_python() {
  local cmd=("$@")
  "${cmd[@]}"
}

ensure_dir() { mkdir -p "$1"; }

check_env() {
  log_info "开始第一阶段：环境检测"
  need_command "$PYTHON_BIN" || return 1
  need_command ffmpeg || return 1
  need_command ffprobe || return 1

  if [[ ! -d "$BACKEND_DIR" ]]; then
    log_error "BACKEND_DIR 不存在：$BACKEND_DIR"
    return 1
  fi
  ensure_cli_entrypoint || return 1

  local config_dir
  config_dir="$(dirname "$SCAN_CONFIG_PATH")"
  if [[ ! -d "$config_dir" ]]; then
    log_error "config 目录不存在：$config_dir"
    return 1
  fi
  if [[ ! -f "$SCAN_CONFIG_PATH" ]]; then
    log_error "扫描配置文件不存在：$SCAN_CONFIG_PATH"
    return 1
  fi
  if [[ ! -f "$FINAL_CONFIG_PATH" ]]; then
    log_error "切片配置文件不存在：$FINAL_CONFIG_PATH"
    return 1
  fi
  if [[ ! -f "$BACKEND_DIR/requirements.txt" ]]; then
    log_error "requirements.txt 不存在：$BACKEND_DIR/requirements.txt"
    return 1
  fi
  if [[ ! -d "$INPUT_VIDEO_DIR" ]]; then
    log_warn "输入目录不存在：$INPUT_VIDEO_DIR（将由脚本报错并停止）"
  fi

  if [[ -z "$QWEN_API_KEY" ]]; then
    local env_key
    local normalized_env_key
    env_key="${QWEN_API_KEY_ENV_NAME:-QWEN_API_KEY}"

    if looks_like_qwen_api_key "$env_key" && ! is_valid_env_name "$env_key"; then
      QWEN_API_KEY="$env_key"
      QWEN_API_KEY_ENV_NAME="QWEN_API_KEY"
      log_warn "检测到 QWEN_API_KEY_ENV_NAME 被误填为 Key，已自动纠正为 QWEN_API_KEY。"
      return 0
    fi

    normalized_env_key="${env_key//[[:space:]]/}"
    if is_valid_env_name "$normalized_env_key" && [[ -z "${!normalized_env_key-}" ]]; then
      log_warn "$normalized_env_key 未配置，最终切片阶段可能无法使用 ASR/边界模型。"
    elif ! is_valid_env_name "$normalized_env_key"; then
      log_warn "QWEN_API_KEY_ENV_NAME 无效（应是环境变量名，如 QWEN_API_KEY）：${normalized_env_key}；请改为配置 QWEN_API_KEY。"
    fi
  fi

  log_ok "环境检测通过"
}

ensure_python_env() {
  log_info "开始第二阶段：Python 虚拟环境与依赖"

  local python_cmd="$PYTHON_BIN"
  if [[ "$python_cmd" == python* ]]; then
    python_cmd="$(command -v "$python_cmd")"
  fi

  if [[ -z "$python_cmd" ]]; then
    log_error "无法解析 Python 二进制：$PYTHON_BIN"
    return 1
  fi
  if [[ ! -x "$python_cmd" ]]; then
    log_error "Python 二进制不可执行：$python_cmd"
    return 1
  fi

  log_info "使用 Python：$python_cmd"
  if [[ ! -d "$BACKEND_VENV_DIR" ]]; then
    log_info "未检测到虚拟环境，开始创建：$BACKEND_VENV_DIR"
    run_python "$python_cmd" -m venv "$BACKEND_VENV_DIR"
    log_ok "已创建虚拟环境"
  fi

  local python_exe="$BACKEND_VENV_DIR/bin/python"
  if [[ ! -x "$python_exe" ]]; then
    log_error "虚拟环境内未找到 python：$python_exe"
    return 1
  fi

  log_info "开始同步依赖（如已安装会自动跳过）"
  run_python "$python_exe" -m pip install --upgrade pip
  run_python "$python_exe" -m pip install -r "$BACKEND_DIR/requirements.txt"
  log_ok "依赖安装完成"

  if [[ -n "${QWEN_API_KEY:-}" ]]; then
    local qwen_env_name
    qwen_env_name="${QWEN_API_KEY_ENV_NAME:-QWEN_API_KEY}"
    if [[ "$qwen_env_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$qwen_env_name=$QWEN_API_KEY"
      log_ok "已注入环境变量：${qwen_env_name}（来自配置文件）"
    else
      log_warn "QWEN_API_KEY_ENV_NAME 无效：${qwen_env_name}，已跳过注入密钥到环境变量"
    fi
  fi

  log_ok "Python 环境就绪"
}

run_scan() {
  if [[ ! -d "$INPUT_VIDEO_DIR" ]]; then
    log_error "输入目录不存在：$INPUT_VIDEO_DIR"
    return 1
  fi

  ensure_dir "$SPLIT_OUTPUT_ROOT"

  log_info "开始执行 scan 阶段"
  local python_exe="$BACKEND_VENV_DIR/bin/python"
  local cmd=("$python_exe" -m app.cli.main scan --input "$INPUT_VIDEO_DIR" --output "$SPLIT_OUTPUT_ROOT" --config "$SCAN_CONFIG_PATH")

  if [[ "$FORCE_RESCAN" == "true" ]]; then
    cmd+=(--force)
  fi
  if [[ "$WITH_CLIPS" == "true" ]]; then
    cmd+=(--with-clips)
  fi

  log_info "执行命令：${cmd[*]}"
  (cd "$BACKEND_DIR" && "${cmd[@]}")
  log_ok "scan 阶段完成"
}

run_final_shot() {
  log_info "开始执行 final_shot 阶段（仅切片）"
  local python_exe="$BACKEND_VENV_DIR/bin/python"
  local db_candidates=()

  if [[ ! -d "$SPLIT_OUTPUT_ROOT" ]]; then
    log_error "输出目录不存在：$SPLIT_OUTPUT_ROOT"
    return 1
  fi

  if [[ -n "$VIDEO_ID" ]]; then
    db_candidates+=("$SPLIT_OUTPUT_ROOT/$VIDEO_ID/shots.db")
  else
    while IFS= read -r -d '' db; do
      db_candidates+=("$db")
    done < <(find "$SPLIT_OUTPUT_ROOT" -name shots.db -print0)
  fi

  if [[ "${#db_candidates[@]}" -eq 0 ]]; then
    log_error "未找到 shots.db，请确认 scan 已正常产出"
    return 1
  fi

  for db in "${db_candidates[@]}"; do
    if [[ ! -f "$db" ]]; then
      log_warn "未找到 db 文件：$db，跳过"
      continue
    fi

    local cmd=("$python_exe" -m app.final_shot --input-db "$db" --config "$FINAL_CONFIG_PATH")

    if [[ "$FORCE_FINAL_REBUILD" == "true" ]]; then
      cmd+=(--force)
    fi
    if [[ "$WITH_CLIPS" == "true" ]]; then
      cmd+=(--with-clips)
    else
      cmd+=(--no-with-clips)
    fi
    if [[ -n "$VIDEO_ID" ]]; then
      cmd+=(--video-id "$VIDEO_ID")
    fi

    log_info "执行命令：${cmd[*]}"
    (cd "$BACKEND_DIR" && "${cmd[@]}")
  done

  log_ok "final_shot 阶段完成"
}

ensure_dir "$SPLIT_LOG_DIR"

check_env || exit 1
if [[ "$CHECK_ONLY" == "true" ]]; then
  log_ok "只做环境检测，已完成"
  exit 0
fi

ensure_python_env || exit 1
run_scan
run_final_shot
log_ok "全部流程完成"
