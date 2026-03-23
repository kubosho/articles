#!/bin/bash

INPUT=$(cat)
f=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // ""')

if [[ "$f" =~ /articles/.*\.md$ ]]; then
  RESULT=""
  RESULT+=$(npx markdownlint-cli2 "$f" 2>&1 || true)
  RESULT+=$'\n'
  RESULT+=$(npx textlint "$f" 2>&1 || true)

  TRIMMED=$(echo "$RESULT" | sed '/^$/d')
  if [[ -n "$TRIMMED" ]]; then
    jq -n --arg ctx "$TRIMMED" --arg msg "$TRIMMED" \
      '{systemMessage: $msg, hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
  fi
fi

exit 0
