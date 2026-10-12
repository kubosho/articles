---
title: Claude Codeのrulesをhooksに移行した
categories: [技術]
tags: [Claude Code, AI]
publishedAt: 2026-03-23T12:00:00.000Z
---

Claude Codeにはrulesとhooksという2つの仕組みがある。rulesはClaude Codeへの指示をMarkdownで書くもので、hooksはツール呼び出しやセッションのライフサイクルに応じてシェルスクリプトなどを自動実行する仕組みだ。

自分はJujutsu（jj）のワークフロールールをrulesとして運用していたが、hooksに移行した。その動機と結果を書く。

## 移行前の状態

`~/.agents/rules/jj-workflow.md`にJujutsuのワークフロールールを定義していた。内容はcommitの粒度やbookmarkの管理、push前のgit hooks実行といった不変条件（invariant）を列挙したもので、Claude Codeはこの指示を読んで行動する。

ただ、この仕組みには問題がある。rulesはあくまでClaude Codeへの「お願い」であり、守られるかどうかはモデルの判断に依存する。指示を読み飛ばすこともあるし、長い会話の中で忘れることもある。

特に以下の操作は、忘れたときの影響が大きい。

- `jj git push`前のgit hooks実行（lefthook/husky）
- `jj squash --into`後のbookmark剥離チェック
- 作業終了時の未記述コミットの検出

これらは「必ず実行されなければならない」性質のもので、rulesの「お願い」では心許ない。

## hooksで何が変わるか

hooksはClaude Codeのツール呼び出しに対するイベントリスナーのようなものだ。`PreToolUse`でツール実行前、`PostToolUse`で実行後、`Stop`で応答終了時にシェルスクリプトを実行できる。

重要なのは、hooksはモデルの判断を介さずに実行される点だ。Bashツールを呼べば必ずフックが走る。rulesを「読んでほしい指示」とすれば、hooksは「仕組みとして組み込まれたガードレール」になる。

## 移行の設計

jj-workflow.mdに定義していた不変条件を、hooksに移行できるものとできないものに分類した。

### hooksに移行したもの

| 不変条件 | Hook Event | トリガー |
| --------- | ----------- | --------- |
| push前にgit hooksを実行 | PreToolUse (Bash) | `jj git push` |
| push前にbookmarkの存在を確認 | PreToolUse (Bash) | `jj git push` |
| describe前に単一コンテキストか確認 | PreToolUse (Bash) | `jj describe` |
| describe後に自動で`jj new`を実行 | PostToolUse (Bash) | `jj describe` |
| describe後にbookmarkの有無を確認 | PostToolUse (Bash) | `jj describe` |
| squash後にbookmark剥離を検出 | PostToolUse (Bash) | `jj squash` |
| 作業完了時に未記述の変更を検出 | Stop | 応答終了時 |

### rulesに残したもの

| 不変条件 | 理由 |
| --------- | ------ |
| working copyが現在のタスクに属するか | 「現在のタスク」の判断にはコンテキストの理解が必要で、スクリプトでは判定できない |
| コミットメッセージのフォーマット | `type: summary`の形式はスクリプトで強制するより、指示として伝えるほうが柔軟 |
| TTY制約（`--interactive`禁止） | 制約の説明であり、チェックというより前提知識 |

判断の基準は「スクリプトで機械的に検証できるか」だった。bookmarkの有無やファイル変更の有無はコマンドの出力で判定できる。一方「このコミットは単一のコンテキストか」は人間（やLLM）の判断が必要なので、hookではdiffの情報を提供するに留め、最終判断はClaude Codeに委ねている。

## 実装

### settings.jsonのhooks設定

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/jj-pre-tool-use.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/jj-post-tool-use.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/jj-stop-check.sh"
          }
        ]
      }
    ]
  }
}
```

matcherに`Bash`を指定しているため、すべてのBashツール呼び出しでフックが発火する。スクリプト内でコマンドの内容を判定し、jj関連でなければ即座に`exit 0`する設計だ。

### PreToolUseフック

`jj git push`と`jj describe`の2つのコマンドを検出する。

```bash
#!/bin/bash
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0
command -v jj >/dev/null 2>&1 || exit 0

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
CWD=$(echo "$INPUT" | jq -r '.cwd')

cd "$CWD" 2>/dev/null || exit 0
[[ -d ".jj" ]] || exit 0

case "$COMMAND" in
  *"jj git push"*)
    # lefthook/huskyがあれば実行し、失敗時はexit 2でブロック
    if [[ -f "lefthook.yml" ]]; then
      OUTPUT=$(lefthook run pre-commit 2>&1) || {
        printf 'lefthook pre-commit failed:\n%s' "$OUTPUT" >&2
        exit 2
      }
      # pre-pushも同様に実行
    fi

    # jj logをcontextとして提供し、bookmark確認を促す
    LOG=$(jj log -r '::@ ~ root()' --limit 10 2>/dev/null || echo "")
    jq -n --arg ctx "[jj-workflow] Verify bookmarks exist on push targets.
jj log:
$LOG" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
    ;;

  *"jj describe"*)
    # diffを提供し、単一コンテキストの確認を促す
    DIFF=$(jj diff --stat 2>/dev/null || echo "")
    jq -n --arg ctx "[jj-workflow] Verify changes are a single logical context.
jj diff --stat:
$DIFF" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
    ;;
esac

exit 0
```

hookの出力形式がポイントだ。`additionalContext`に情報を載せると、Claude Codeはその内容をツール実行の文脈として受け取る。git hooksの失敗は`exit 2`で**ブロック**し、bookmark確認は`additionalContext`で**情報提供**するという使い分けをしている。

ブロックは「この操作を実行してはならない」という強制力を持つ。情報提供は「この情報を踏まえて判断せよ」という補助だ。git hooksの失敗は明確にNGなのでブロック、bookmarkの有無はコンテキスト次第なので情報提供にした。

### PostToolUseフック

`jj describe`と`jj squash`の2つのコマンドを検出する。

```bash
#!/bin/bash
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0
command -v jj >/dev/null 2>&1 || exit 0

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
CWD=$(echo "$INPUT" | jq -r '.cwd')

cd "$CWD" 2>/dev/null || exit 0
[[ -d ".jj" ]] || exit 0

case "$COMMAND" in
  *"jj describe"*)
    jj new 2>/dev/null || true

    PARENT_BOOKMARKS=$(jj log --no-graph -r '@-' -T 'bookmarks' 2>/dev/null || echo "")
    if [[ -z "$PARENT_BOOKMARKS" ]]; then
      PARENT_LOG=$(jj log --no-graph -r '@-' 2>/dev/null || echo "")
      jq -n --arg ctx "[jj-workflow] The described commit has no bookmark.
$PARENT_LOG" \
        '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
    fi
    ;;
  *"jj squash"*)
    LOG=$(jj log -r '::@ ~ root()' --limit 10 2>/dev/null || echo "")
    if [[ -n "$LOG" ]]; then
      jq -n --arg ctx "[jj-workflow] Bookmark attachment check after squash.
jj log:
$LOG" \
        '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
    fi
    ;;
esac

exit 0
```

`jj describe`のハンドリングには2つの役割がある。

1つ目は自動`jj new`の実行だ。jjのworking copyは自動amendされるため、describe後に追加変更すると、元のdescriptionと変更内容が乖離する。`jj new`で新しいworking copyに移ることで、追加変更は未記述の新しいコミットに入り、後述のStopフックで検出できるようになる。

2つ目はbookmarkの有無チェックだ。describeしたコミット（`jj new`後は`@-`）にbookmarkがなければ、pushできない状態なのでcontextで通知する。

`jj squash`のハンドリングは、rewrite後のbookmark剥離をcontextで通知する。

### Stopフック

```bash
#!/bin/bash
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0
command -v jj >/dev/null 2>&1 || exit 0

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')

cd "$CWD" 2>/dev/null || exit 0
[[ -d ".jj" ]] || exit 0

# jj diff (without --stat) outputs nothing when there are no changes
# jj diff --stat always outputs a summary line even with no changes
HAS_DIFF=$(jj diff 2>/dev/null || echo "")
[[ -z "$HAS_DIFF" ]] && exit 0

DESC=$(jj log --no-graph -r @ -T 'description' 2>/dev/null || echo "")

if [[ -z "$DESC" ]]; then
  STAT=$(jj diff --stat 2>/dev/null || echo "")
  jq -n --arg reason "[jj-workflow] Working copy has undescribed changes.
Changed files:
$STAT" \
    '{decision: "block", reason: $reason}'
fi

exit 0
```

Stopフックで`decision: "block"`を返すと、Claude Codeは応答を終了せずに続行する。未記述の変更がある限り止まれないので、describeを実行するまで作業が完了しない仕組みになる。

変更有無の判定には`jj diff`（`--stat`なし）を使っている。`jj diff --stat`は変更がなくても`0 files changed, 0 insertions(+), 0 deletions(-)`というサマリー行を出力するため、空文字チェックをすり抜けてしまう。実際に運用中にこのバグを踏んで修正した。

### graceful fallback

すべてのスクリプトは冒頭で`jq`と`jj`の存在を確認し、なければ`exit 0`で何もしない。`.jj`ディレクトリがないリポジトリでも同様だ。hookはすべてのBashツール呼び出しで発火するので、jj以外のプロジェクトで誤動作しないことが重要になる。

## 移行してみて

rulesとhooksは排他ではなく補完関係にある。「機械的に検証できるチェック」をhooksで仕組み化し、「判断が必要な指示」をrulesに残す。この切り分けで、ワークフローの信頼性が上がった。

hooksにはオーバーヘッドがある。すべてのBashコマンドでスクリプトが走るため、jqのパースが毎回入る。ただ実測で数十ミリ秒程度なので、体感への影響はなかった。

一方で、rulesにしかできないこともある。「working copyが現在のタスクに属するか」のような、状況の意味を理解する必要がある判断は、スクリプトでは書けない。rulesは万能ではないが、LLMの文脈理解に委ねるべき指示の置き場所として機能している。

hooksを実際に動かしてみると、想定外の挙動に気づくことがある。`jj diff --stat`が空のworking copyでもサマリー行を出力する件は、コードを読むだけでは気づけなかった。hookは書いたら実際に発火させてデバッグするのが早い。

結論としては、rulesをhooksに「移行」するというよりも、rulesの中から仕組み化できるものを抽出してhooksに移した、という表現が正確だ。
