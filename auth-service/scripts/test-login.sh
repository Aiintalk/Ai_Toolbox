#!/usr/bin/env bash
# 一次性验证三种角色的登录流程
# 用法： bash scripts/test-login.sh
# 可选环境变量： BASE_URL（默认 http://localhost:3000）

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
LOGIN_URL="$BASE_URL/auth/api/login"
ME_URL="$BASE_URL/auth/api/me"

ACCOUNTS=(
  "admin|admin123|admin"
  "darenshuo|darenshuo123|employee"
  "test1|test123|kol"
)

echo "== Auth Service 登录测试 =="
echo "BASE_URL = $BASE_URL"
echo

for entry in "${ACCOUNTS[@]}"; do
  IFS='|' read -r USER PASS EXPECT <<< "$entry"
  echo "---- [$EXPECT] $USER ----"

  COOKIE_FILE=$(mktemp)

  RESP=$(curl -sS -c "$COOKIE_FILE" -X POST "$LOGIN_URL" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")

  echo "登录响应： $RESP"

  if echo "$RESP" | grep -q '"ok":true'; then
    echo "✅ 登录成功，cookie 已下发"
    ME=$(curl -sS -b "$COOKIE_FILE" "$ME_URL" || true)
    if [[ -n "$ME" ]]; then
      echo "会话校验： $ME"
    fi
  else
    echo "❌ 登录失败"
  fi

  rm -f "$COOKIE_FILE"
  echo
done

echo "== 完成 =="
echo "提示：员工/网红登录后页面 404 属于正常，因为 /portal /kol-portal 由生产网关代理到其他应用。"
echo "     本地只要看到 ok:true + Set-Cookie，就说明 auth-service 工作正常。"
