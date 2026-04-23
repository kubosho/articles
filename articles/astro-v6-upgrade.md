---
title: Astro v6へのアップグレードを試みて断念した
categories: [技術]
tags: [Astro, Cloudflare Workers, ブログ]
publishedAt: 2026-03-17T12:00:00.000Z
---

このブログをAstro v5からv6にアップグレードしようとして、最終的にv5に戻しました。アップグレード自体は簡単でしたが、Cloudflare Workersのデプロイでバインディングが消える問題があり、現時点では実用できないと判断しました。

## アップグレード自体はスムーズだった

このプロジェクトは既にContent Layer API、`astro/zod`からのimport、Vite 7を使っていたため、v6で求められる移行作業の大半が不要でした。実際に対応が必要だったのは以下の3点です。

### wrangler.jsoncのmainフィールド削除

`@astrojs/cloudflare` v13では内部で`@cloudflare/vite-plugin`が使われるようになり、ビルドの出力構造が変わっています。以前は `wrangler.jsonc` に `"main": "./dist/_worker.js/index.js"` を指定していましたが、v13ではアダプタ側が自動でエントリポイントを管理するため、この指定があると「ファイルが見つからない」エラーになります。

対応は `main` フィールドの削除だけで済みました。

### ESLintの型推論エラー

`astro.config.ts` の `integrations` 配列に対して、ESLintの `@typescript-eslint/no-unsafe-assignment` エラーが出ました。各integrationの関数は型定義上 `AstroIntegration` を返しているのですが、ESLintのパーサーが配列全体を `any[]` と推論してしまうようです。`as AstroIntegration[]` の型アサーションで対処しました。

### locals.runtimeの廃止

Astro v6では `Astro.locals.runtime` が廃止され、`cloudflare:workers` モジュールからのimportに移行するよう案内されています。このブログでは `locals.runtime.caches` と `locals.runtime.env` の2箇所で使っていたため、それぞれ移行しました。

`locals.runtime.caches` はグローバルの `caches` オブジェクトに、`locals.runtime.env` は `cloudflare:workers` の `env` に置き換えました。ローカルの開発サーバー(`npm run dev`)では問題なく動作しました。

## デプロイで壊れた

staging環境にデプロイしたところ、いいねAPIが全記事で500エラーを返すようになりました。

エラーは `Failed query: select sum("counts") from "likes"` というDBクエリの失敗。DB接続自体は確立しているがクエリが失敗している状態でした。

### 原因の特定

デプロイログを見て原因が分かりました。

```
Your Worker has access to the following bindings:
env.SESSION (inherited)      KV Namespace
env.IMAGES                   Images
env.ASSETS                   Assets
```

Hyperdrive と Rate Limiter のバインディングが含まれていません。`wrangler.jsonc` の `env.staging` セクションに定義した環境固有のバインディングが、デプロイされたWorkerに反映されていませんでした。

### @astrojs/cloudflare v13のredirected wrangler config

`@astrojs/cloudflare` v13は `@cloudflare/vite-plugin` を使うようになり、ビルド時に `dist/server/wrangler.json` という「redirected config」を生成します。`wrangler deploy --env staging` を実行すると、このredirected configが使われます。

問題は、この生成されたconfigにはルートレベルの設定しか含まれないことです。`wrangler.jsonc` の `env.staging` や `env.production` に定義したHyperdriveやRate Limiterの設定は無視されます。

これは[withastro/astro#15917](https://github.com/withastro/astro/issues/15917)として報告されており、`@cloudflare/vite-plugin` の設計上の制約とされています。

### ワークアラウンドはある

ビルド時に `CLOUDFLARE_ENV` 環境変数を設定すれば、指定した環境のバインディングが含まれます。

```bash
CLOUDFLARE_ENV=staging astro build
```

ただし環境ごとに別ビルドが必要になります。「1回ビルドして複数環境にデプロイ」というワークフローが使えなくなるため、今回は採用しませんでした。

## いいね数のスケルトン改善も試みた

アップグレードとあわせて、いいね数の初期表示からスケルトンを消す改善も試みました。

### SSG方式の問題

ビルド時にDBからいいね数を取得してHTMLに埋め込む方式を試しました。SWRの `fallbackData` に設定すればスケルトンが消えるはずでしたが、2つの問題がありました。

1つ目は、AstroのSSGでReactコンポーネントをサーバーレンダリングするとき、SWRが `isLoading: true` を返すため、`fallbackData` を設定してもスケルトンが初期HTMLに焼き込まれること。これはスケルトンの表示条件を `isLoading && initialCount == null` に変更することで対処できました。

2つ目は、ビルド時の値と最新値にずれがあると、ページ読み込み時にカウントが1→5のようにジャンプすること。スケルトンの代わりにカウントのジャンプが見えるだけで、本質的には同じ問題でした。

### Server Islandsの壁

Astro v6のServer Islandsを使えば、記事ページは静的のまま、いいねボタンだけをリクエスト時にサーバーレンダリングできるはずでした。しかし、Cloudflare Workers上でServer Island内のReactコンポーネントが空レスポンスを返す問題があり、使えませんでした。

## v5に戻した

結局、Astro v6へのアップグレードをすべてrevertしてv5に戻しました。

理由はシンプルです。`@astrojs/cloudflare` v13がCloudflare Workersの環境固有バインディングをデプロイ時に含めないため、Hyperdrive経由のDB接続やRate Limitingが動作しません。いいねAPIが壊れた状態で本番運用はできません。

## 得られた教訓

Astro v6自体のアップグレードは容易でした。Content Layer APIや`astro/zod`を既に使っていれば、コード側の変更はほぼ不要です。

問題はアダプタ側にあります。`@astrojs/cloudflare` v13は `@cloudflare/vite-plugin` に大きく依存する構成に変わっており、Cloudflare Workersの環境（`--env staging` / `--env production`）を使ったデプロイが正しく動作しません。この問題はissueとして認識されていますが、修正は `@cloudflare/vite-plugin` 側で行われる必要があり、Astroのアダプタだけでは対処できない構造です。

devサーバーでは問題なく動作するため、ローカル開発だけで検証していると本番デプロイ時に初めて問題が発覚します。Cloudflare Workersで環境固有のバインディングを使っている場合は、staging環境へのデプロイまで含めて検証してからマージすべきでした。
