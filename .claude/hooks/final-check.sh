#!/bin/bash
# セッション終了時の最終確認
# Stop: Claude がレスポンスを完了した時に発火

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

echo "=== Final Check ===" >&2

# 1. Git状態の確認
echo "" >&2
echo "[Git Status]" >&2
git_status=$(git status --porcelain 2>/dev/null)
if [ -n "$git_status" ]; then
  echo "Uncommitted changes:" >&2
  echo "$git_status" >&2
else
  echo "Working directory clean" >&2
fi

# 2. ステージされた変更にconsole.logがないかチェック
staged_files=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' | grep -v -E '\.test\.|\.spec\.|__tests__' || true)
if [ -n "$staged_files" ]; then
  echo "" >&2
  echo "[Console.log Check in Staged Files]" >&2
  has_console_log=false
  for file in $staged_files; do
    if [ -f "$file" ]; then
      matches=$(grep -n "console\.log" "$file" 2>/dev/null || true)
      if [ -n "$matches" ]; then
        echo "  $file:" >&2
        echo "$matches" | sed 's/^/    /' >&2
        has_console_log=true
      fi
    fi
  done
  if [ "$has_console_log" = false ]; then
    echo "  No console.log found in staged files" >&2
  fi
fi

exit 0
