#!/bin/bash
# console.log の検出と警告
# PostToolUse: Edit|Write ツール実行後に発火

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# TypeScript/JavaScript ファイルのみチェック
if [[ "$file_path" == *.ts ]] || [[ "$file_path" == *.tsx ]] || [[ "$file_path" == *.js ]] || [[ "$file_path" == *.jsx ]]; then
  # テストファイルは除外
  if [[ "$file_path" == *.test.* ]] || [[ "$file_path" == *.spec.* ]] || [[ "$file_path" == *"__tests__"* ]]; then
    exit 0
  fi

  # console.log を検索
  if [ -f "$file_path" ]; then
    matches=$(grep -n "console\.log" "$file_path" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      echo "Warning: console.log found in $file_path" >&2
      echo "$matches" >&2
      echo "Consider removing before committing." >&2
    fi
  fi
fi

exit 0
