#!/bin/bash

f=$(jq -r '.tool_input.file_path // .tool_response.filePath')

if [[ "$f" =~ /articles/.*\.md$ ]]; then
  npx markdownlint-cli2 "$f" 2>&1
  npx textlint "$f" 2>&1
fi
