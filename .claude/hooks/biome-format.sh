#!/bin/bash
# 編集されたファイルを自動でBiomeフォーマット
# PostToolUse: Edit|Write ツール実行後に発火

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# ファイルが存在しない場合はスキップ
if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

# TypeScript/JavaScript/JSON ファイルのみフォーマット
if [[ "$file_path" == *.ts ]] || [[ "$file_path" == *.tsx ]] || \
   [[ "$file_path" == *.js ]] || [[ "$file_path" == *.jsx ]] || \
   [[ "$file_path" == *.json ]]; then

  cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

  # Biomeでフォーマット（該当ファイルのみ）
  pnpm biome format --write "$file_path" 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "Formatted: $file_path" >&2
  fi
fi

exit 0
