#!/bin/bash
# Git push前のリマインダー
# PreToolUse: Bash で git push コマンド実行前に発火

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# git push コマンドかチェック
if [[ "$command" == *"git push"* ]]; then
  # 未コミットの変更がないか確認
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Warning: You have uncommitted changes. Consider committing them first." >&2
  fi

  # 現在のブランチを表示
  current_branch=$(git branch --show-current)
  echo "Pushing to branch: $current_branch" >&2

  # main/masterへの直接pushを警告
  if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
    echo "Warning: You are pushing directly to $current_branch branch." >&2
  fi
fi

exit 0
