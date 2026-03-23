---
title: Web Speed Hackathon 2026参加記
categories: [技術]
tags: [ハッカソン, パフォーマンス]
publishedAt: 2026-03-20T03:00:00.000Z
revisedAt: 2026-03-20T03:00:00.000Z
---
逐次Lighthouseを回していた影響で並列化はあまりできなかったけど、それでもコミット数がちょうど100まで達したのはAIエージェントによる高速実装があったおかげ。何をパフォーマンスチューニングするかを決めるのはまだ人間側に委ねられているなと感じました。個人的にはどうしてもデータベース周りが弱くてインデックスを貼る思考に至らなかったなという反省があります。

あとBaseline Skillを作ったにも関わらず[Translator](https://developer.mozilla.org/en-US/docs/Web/API/Translator)の存在に気づけなかったというのもあります。一応以下のようにプロンプトを書けばTranslatorが出てくるので、これを元に実装のヒントは得られそうでした。

```shell
❯ Chrome最新版でのみ使える機能の一覧をbaselineで出して
Chromiumを使っているブラウザーも除外して

⏺ Skill(baseline)
  ⎿  Successfully loaded skill

⏺ Chromeでのみ利用可能で、Edge・Firefox・Safariでは使えない機能を検索する。

  クエリ: available_on:chrome -available_on:edge -available_on:firefox -available_on:safari

⏺ Fetch(https://api.webstatus.dev/v1/features?q=available_on:chrome+-available_on:edge+-available_on:firefox+-available_on:safari)
  ⎿  Received 4.4KB (200 OK)

⏺ Chrome最新版でのみ使える機能（Edge・Firefox・Safari非対応）

  合計: 6件 — すべて Baseline status: Limited

  ┌───────────────────────────┬───────────────────┬────────────┬─────────────────────────────────────────────────────────────────────┐
  │           機能            │ Chrome バージョン │ 利用開始日 │                                備考                                 │
  ├───────────────────────────┼───────────────────┼────────────┼─────────────────────────────────────────────────────────────────────┤
  │ Language detector         │ 138               │ 2025-06-24 │ 言語検出API。Translation API仕様の一部                              │
  ├───────────────────────────┼───────────────────┼────────────┼─────────────────────────────────────────────────────────────────────┤
  │ Network Information       │ 67                │ 2018-05-29 │ 接続種別・帯域幅の取得。Mozilla は negative ポジション              │
  ├───────────────────────────┼───────────────────┼────────────┼─────────────────────────────────────────────────────────────────────┤
  │ Non-cookie storage access │ 125               │ 2024-05-14 │ Cookie以外のストレージへのクロスサイトアクセス。Mozilla は positive │
  ├───────────────────────────┼───────────────────┼────────────┼─────────────────────────────────────────────────────────────────────┤
  │ Summarizer                │ 138               │ 2025-06-24 │ テキスト要約API（Writing Assistance APIs）。Mozilla negative        │
  ├───────────────────────────┼───────────────────┼────────────┼─────────────────────────────────────────────────────────────────────┤
  │ Translator                │ 138               │ 2025-06-24 │ テキスト翻訳API（Translation API）                                  │
  ├───────────────────────────┼───────────────────┼────────────┼─────────────────────────────────────────────────────────────────────┤
  │ Hand input (WebXR)        │ 131               │ 2024-11-12 │ WebXRハンドトラッキング。WebKit は support                          │
  └───────────────────────────┴───────────────────┴────────────┴─────────────────────────────────────────────────────────────────────┘

  注目すべき点として、Language detector / Summarizer / Translator の3つは Chrome 138（2025-06-24）で同時に追加された Built-in AI 系のAPIで、他ブラウザの実装見込みは薄い。Network Information
  は2018年から存在するが、Mozillaが明確に反対しており、標準化が進んでいない。
```

一方で来年か再来年にはまた景色が変わりそう。もしAIエージェントとしてより自律して動けるようになったら？提案を積極的にしてくるようになったら？OpenClawみたいな仕組みが一般化したら？といったことが挙げられます。

第1回から参加し続けているのもあって、出題された問題の中には過去にも出てきた問題がありました。念のため2のn乗実行とか。フォント周りのサボタージュとか。そういったメタ観点で改善点を見出した部分もありました。

あとは今年もレギュレーション遵守ゲーになりました。一定の改善をできれば（足切りラインを越えれば）レギュレーションを遵守するだけで上位にいける可能性があります。

## スコアの推移

最終スコアは **764.80 / 1150点** でした。ただしレギュレーション違反（VRT不一致）によりランキングからは除外されています。

違反の原因は、ユーザープロフィールのヘッダー背景色が初期アプリと異なっていた点です。`UserProfileHeader.tsx` でプロフィール画像の平均色を Tailwind の動的クラス `` bg-[${averageColor}] `` として適用していましたが、`@tailwindcss/browser`（ランタイム）を `@tailwindcss/postcss`（ビルド時コンパイル）に置き換えたことで、実行時に生成される任意の値クラスが解決されなくなりました。ビルド時コンパイルではソースコード中のクラス名を静的に抽出するため、テンプレートリテラルで動的に組み立てたクラスは検出できません。修正するなら `style={{ backgroundColor: averageColor }}` のようにインラインスタイルに切り替える必要がありました。

初期スコアと最終スコアの内訳は以下の通りです。

**初期スコア: 219.00点**

何も改善していないタイミングのスコアです。

| テスト項目 | CLS (25) | FCP (10) | LCP (25) | SI (10) | TBT (30) | 合計 (100) |
|-----------|----------|----------|----------|---------|----------|-----------|
| ホームを開く | 20.75 | 0.00 | 0.00 | 0.00 | 0.00 | 20.75 |
| 投稿詳細ページを開く | 25.00 | 0.00 | 0.00 | 0.00 | 0.00 | 25.00 |
| 写真つき投稿詳細ページを開く | 24.75 | 0.00 | 0.00 | 0.00 | 0.00 | 24.75 |
| 動画つき投稿詳細ページを開く | 23.50 | 0.00 | 0.00 | 0.00 | 0.00 | 23.50 |
| 音声つき投稿詳細ページを開く | 25.00 | 0.00 | 0.00 | 0.00 | 0.00 | 25.00 |
| 検索ページを開く | 25.00 | 0.00 | 0.00 | 0.00 | 0.00 | 25.00 |
| DM一覧ページを開く | 25.00 | 0.00 | 0.00 | 0.00 | 0.00 | 25.00 |
| DM詳細ページを開く | 25.00 | 0.00 | 0.00 | 0.00 | 0.00 | 25.00 |
| 利用規約ページを開く | 25.00 | 0.00 | 0.00 | 0.00 | 0.00 | 25.00 |

ユーザーフローテストは表示スコアが300点未満のため全項目「計測できません」でした。CLSだけがスコアを持ち、FCP/LCP/SI/TBTはすべて0点です。

**最終スコア: 764.80点（暫定32位→正式結果ランキング除外）**

| テスト項目 | CLS (25) | FCP (10) | LCP (25) | SI (10) | TBT (30) | 合計 (100) |
|-----------|----------|----------|----------|---------|----------|-----------|
| ホームを開く | 25.00 | 8.00 | 8.75 | 3.20 | 0.00 | 44.95 |
| 投稿詳細ページを開く | 25.00 | 8.80 | 17.00 | 8.40 | 29.40 | 88.60 |
| 写真つき投稿詳細ページを開く | 25.00 | 9.20 | 17.75 | 9.20 | 29.70 | 90.85 |
| 動画つき投稿詳細ページを開く | 25.00 | 9.20 | 17.75 | 8.70 | 23.10 | 83.75 |
| 音声つき投稿詳細ページを開く | 25.00 | 9.30 | 17.75 | 9.80 | 30.00 | 91.85 |
| 検索ページを開く | 25.00 | 8.90 | 0.75 | 9.40 | 8.10 | 52.15 |
| DM一覧ページを開く | 25.00 | 8.80 | 16.00 | 6.90 | 23.70 | 80.40 |
| DM詳細ページを開く | 25.00 | 9.10 | 13.00 | 5.40 | 0.00 | 52.50 |
| 利用規約ページを開く | 25.00 | 9.20 | 19.25 | 9.20 | 8.10 | 70.75 |

| ユーザーフローテスト | INP (25) | TBT (25) | 合計 (50) |
|-------------------|----------|----------|----------|
| ユーザー登録→サインアウト→サインイン | 25.00 | 9.00 | 34.00 |
| DM送信 | - | - | 計測できません |
| 検索→結果表示 | 25.00 | 25.00 | 50.00 |
| Crok AIチャット | 25.00 | 0.00 | 25.00 |
| 投稿 | - | - | 計測できません |

大きくスコアを伸ばした段階は3つあります。750.85点到達以降は伸び悩みました。

**1回目（18:08）: 219 → 498.75点** — JSバンドルの構造改善

Rspack移行（108MB→12.3MB）、ルートベースのコード分割（12.3MiB→462KiB）、web-llmのdynamic import、jQuery同期XHR除去、Tailwindランタイム除去、262,144回ループ除去、gzip圧縮、妨害ヘッダー除去、contenthash長期キャッシュなど、初期ロードに関わる改善をまとめてデプロイした結果です。個別では小さい改善も、積み上がることでFCP/SI/TBTが一気にスコア閾値を超えました。

**2回目（18:57）: 498.75 → 576.6点** — 追加のdynamic importとReDoS修正

FFmpeg/ImageMagick WASMのdynamic import（44.5MBを初期バンドルから除外）とReDoS脆弱性の修正（3箇所）が主な変更です。

**3回目（22:26）: 576.6 → 750.85点** — メディアファイルの最適化

GIF→MP4変換（TBT 6.7s→2.5s）、波形データの事前計算によるAudioContextデコード排除（TBT 2.5s→49ms）、JPEG→AVIF変換+リサイズ（画像93%削減、LCP 42s→7.3s）が中心です。特に波形事前計算の効果が大きく、Performanceスコアが0.25→0.56に跳ね上がりました。

---

cloneして、リポジトリのサイズがおかしいことに気づきました。407.12 MiBは大きいですね。

```shell
remote: Enumerating objects: 412, done.
remote: Total 412 (delta 0), reused 0 (delta 0), pack-reused 412 (from 1)
Receiving objects: 100% (412/412), 407.12 MiB | 9.07 MiB/s, done.
Resolving deltas: 100% (39/39), done.
Updating files: 100% (354/354), done.
```

後で調べたところ、シードデータのメディアファイルが合計334MBあり、これがリポジトリサイズの大半を占めていました。内訳は動画（GIF）179MB、画像（JPEG）89MB、音声（MP3）66MB。動画が全てGIF形式で保存されているのが特に大きいです。

## デプロイ

運営が用意したfly.ioの環境は競技開始直後に認証周りの問題があったので、早々に自前のfly.ioアカウントへデプロイすることにしました。

`fly apps create kubosho-wsh-2026` でアプリを作成し、`fly deploy --app kubosho-wsh-2026` でデプロイしました。

## Babel設定の最適化

`application/client/babel.config.js` を確認したところ、意図的に仕込まれたボトルネックがいくつかありました。

- `targets: "ie 11"` — Chrome最新版だけ対応すればいいのにIE11向けに変換している
- `modules: "commonjs"` — ESMをCJSに変換するのでwebpackのtree shakingが効かない
- `development: true` (preset-react) — 開発用のチェックコードが本番に含まれる

以下のように修正しました。

```js
module.exports = {
  presets: [
    ["@babel/preset-typescript"],
    [
      "@babel/preset-env",
      {
        targets: "last 1 chrome version",
        modules: false,
      },
    ],
    [
      "@babel/preset-react",
      {
        runtime: "automatic",
      },
    ],
  ],
};
```

## バンドル分析

webpack-bundle-analyzerを導入してバンドル構成を可視化しました。main.jsが108MBという異常なサイズです。

サイズの大きい順に以下の通りです。

1. **FFmpeg WASM** (`ffmpeg-core.wasm?binary`) — 動画処理用。圧倒的に大きい
2. **ImageMagick WASM** (`magick.wasm?binary`) — 画像処理用
3. **@mlc-ai/web-llm** — AI推論エンジン
4. **negaposi-analyzer-ja** (`pn_ja.dic.json`) — 感情分析辞書 (3.29MB)
5. **highlight.js / refractor** — シンタックスハイライト（全言語入り）
6. **moment / lodash / jquery / core-js / bluebird / kuromoji / katex** — 重量級ライブラリ群

webpack configにも問題が多いです。

- `mode: "none"` — minificationなし
- `optimization.minimize: false` — 圧縮無効
- `optimization.splitChunks: false` — コード分割なし
- `optimization.usedExports: false` / `sideEffects: false` — tree shaking無効
- `optimization.concatenateModules: false` — モジュール連結無効
- `devtool: "inline-source-map"` — ソースマップがバンドルに含まれる
- `entry` に `core-js` と `regenerator-runtime` が丸ごと含まれている
- `NODE_ENV: "development"` がハードコードされている

## WebpackからRspackへの移行

webpack configの問題を一つずつ直すより、Rspackに移行してまともなデフォルトに乗り換える方が手っ取り早いと判断しました。

主な変更点は以下の通りです。

- webpack 5 + babel-loader → Rspack + builtin:swc-loader (SWCベース)
- `mode: "production"` でminification・tree shaking・モジュール連結が自動有効化
- `splitChunks: { chunks: "all" }` でコード分割
- `devtool: false` でソースマップをバンドルから除外
- エントリから `core-js`, `regenerator-runtime` を除去
- CSS処理は `CssExtractRspackPlugin` + `css-loader` + `postcss-loader`
- `HtmlRspackPlugin` で `inject: true` にしてスクリプト/CSSを自動注入

結果は以下の通りです。

- ビルド時間: ~15秒 → **0.9秒**
- エントリポイント合計: 108MB → **12.3MB**
- WASMファイル (FFmpeg 30.7MB, ImageMagick 13.8MB) は別ファイルとして出力されるようになりました

## E2Eテストの修正

E2Eテスト（Playwright）を単一ワーカーで実行すると、認証フォームのテストが全滅する問題がありました。並列実行（5ワーカー）では通るが、単一ワーカーだと失敗します。

### 問題1: pressSequentiallyでユーザー名が入力されない

traceで確認したところ、`pressSequentially` でユーザー名フィールドに文字が入らず、パスワードフィールドにだけ入力されていました。

原因は `AuthModalContainer` の `toggle` イベントハンドラにありました。ダイアログの開閉時に `setResetKey` を呼んで `AuthModalPage` を再マウントしていましたが、Invoker Commands API (`command="show-modal"`) の `toggle` イベントが非同期に発火するため、テストがユーザー名を入力している最中にフォームが再マウントされ、入力途中のフィールドが破棄されていました。パスワードフィールドは再マウント後に入力されるため問題ありませんでした。

### 問題2: autoFocusを付けるとフォーム切替が壊れる

`autoFocus` を付けるとフォーカス問題は解決しますが、「初めての方はこちら」ボタンのクリックで `change("type", "signup")` が効かなくなり、見出しが「サインイン」のまま変わらなくなりました。

### 解決策

`resetKey` の更新をダイアログの `close` 時のみに変更しました。

```ts
const handleToggle = (e: Event) => {
  if ((e as ToggleEvent).newState === "closed") {
    setResetKey((key) => key + 1);
  }
};
```

open時に再マウントしなくなったことで、`pressSequentially` のタイミング競合が解消しました。フォーカス操作も不要になっています。close時にリセットするので、次回ダイアログを開いた時にはフォームが初期化されています。

## 初回スコア計測

Rspack移行後のデプロイでスコアリングした結果は **216.75 / 1150点（暫定34位）** でした。

- CLS: ほぼ満点（レイアウトシフトなし）
- FCP, LCP, SI, TBT: すべて0点
- ユーザーフロー: 表示が300点未満のため計測スキップ

## サーバーのgzip圧縮

Expressサーバーに `compression` ミドルウェアを追加し、レスポンスのgzip圧縮を有効化しました。全ミドルウェアの先頭に配置し、APIレスポンスと静的ファイルの両方を圧縮対象にしています。

```diff
+import compression from "compression";
 import Express from "express";

 export const app = Express();

 app.set("trust proxy", true);

+app.use(compression());
 app.use(sessionMiddleware);
```

JSバンドルやAPIレスポンスなどテキストベースのリソースは、圧縮により転送サイズが大幅に削減されます。

また、全レスポンスに付与されていたヘッダーにも罠がありました。

```diff
-app.use((_req, res, next) => {
-  res.header({
-    "Cache-Control": "max-age=0, no-transform",
-    Connection: "close",
-  });
-  return next();
-});
```

- `no-transform`: プロキシやCDNによる圧縮変換を禁止する。せっかくgzip圧縮を入れても中間プロキシで効かなくなる
- `max-age=0`: ブラウザキャッシュを完全に無効化。毎回サーバーにリクエストが飛ぶ
- `Connection: close`: HTTP Keep-Aliveを無効化し、リクエストごとにTCP接続を張り直す

3つとも意図的な妨害コードでした。認証済みユーザー向けのAPIレスポンスがあるため `public` キャッシュは使えず、ミドルウェアごと削除しました。キャッシュ設定は必要に応じてルート単位で行います。

## 静的ファイルのcontenthashと長期キャッシュ

rspackの出力ファイル名にハッシュが付いていなかったため、`[contenthash]` を追加しました。

```js
// rspack.config.js
output: {
  filename: "scripts/[name]-[contenthash].js",
  chunkFilename: "scripts/chunk-[contenthash].js",
},
// CssExtractRspackPlugin
{ filename: "styles/[name]-[contenthash].css" }
```

これにより内容が変われば必ずURLが変わるので、長期キャッシュが安全になります。staticRouterで `/scripts`, `/styles`, `/assets` パスに `Cache-Control: public, max-age=31536000, immutable` を設定しました。

```ts
// routes/static.ts
staticRouter.use("/scripts", (_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
});
```

認証が必要なAPIレスポンスやハッシュのない静的ファイル（index.html等）にはキャッシュヘッダーを付けていません。

## Lighthouse CIによる継続的パフォーマンス観測

最適化の効果を定量的に追跡するため、[Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)を導入しました。

mainブランチへのpush時にfly.ioへ自動デプロイし、デプロイ完了後にLighthouse CIでパフォーマンスを計測する構成にしました。計測対象は認証不要な7ページ（トップ、投稿詳細4種、検索、利用規約）で、各ページ3回計測の中央値を採用します。

```js
// lighthouserc.js
const baseUrl = process.env.LHCI_BASE_URL || 'http://localhost:3000';

export default {
  ci: {
    collect: {
      url: [
        `${baseUrl}/`,
        `${baseUrl}/posts/ff93a168-ea7c-4202-9879-672382febfda`,
        // ... 他5ページ
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

GitHub Actionsのワークフローは2ジョブ構成で、deployジョブでfly.ioにデプロイ → lighthouseジョブでDB初期化後にLHCI実行という流れです。レポートはtemporary-public-storageにアップロードされ、URLで結果を確認できます。

### ローカル計測

CIは事後の記録ですが、改善施策の前後比較はローカルで回したいです。`@lhci/cli` をdevDependencyに追加し、`pnpm lighthouse` でローカルサーバーに対してLHCIを実行できるようにしました。

```bash
# application/ でサーバー起動後
pnpm lighthouse
```

CIと同じ設定ファイル（`lighthouserc.cjs`）を使い、`LHCI_BASE_URL` 未指定時は `http://localhost:3000` に対して計測します。改善施策の実装前後でこれを実行して、ターゲットのメトリクスが実際に改善したか確認します。

特定のページだけ計測したい場合は `lighthouse:page` スクリプトに `--collect.url` でURLを渡します。

```bash
# ホームページだけ計測（1回実行）
pnpm lighthouse:page -- --collect.url="http://localhost:3000/"

# 検索ページだけ計測
pnpm lighthouse:page -- --collect.url="http://localhost:3000/search"
```

最初はconfigファイル内で環境変数 `LHCI_URL` を参照してURLをフィルタリングしようとしましたが、lhciは `LHCI_` プレフィックスの環境変数をCLIオプションとして自動解釈します（`LHCI_URL=/` → `--url=/`）。そのためconfigで組み立てた完全なURLが環境変数の値で上書きされ、Lighthouseにパス `/` だけが渡されて `INVALID_URL` になりました。configに独自のフィルタリングロジックを持たせるのではなく、CLIオプションの `--collect.url` で計測対象を絞り込む方が素直でした。

### 計測の方法論

最適化の進め方として「仮説→計測→変更→計測」のサイクルをルール化しました。

よく「推測するな、計測せよ」と言われますが、これはRob Pikeの原文（"Notes on Programming in C"）の誤訳に近いです。Pikeが戒めているのは「根拠のない当て推量でspeed hackを入れること」であり、仮説を立てること自体ではありません。むしろ計測には仮説が先立つべきで、仮説なき計測はツールが何を測っているかの解釈を誤ります（参考: [「推測するな、計測せよ」についての雑感](https://aki33524.hatenablog.com/entry/2023/08/25/231051)）。

具体的には、最適化コードを書く前に「何が遅いか、なぜ遅いか、どのメトリクスに反映されるか」を明言し、計測で裏付けてから手を入れます。変更後にターゲットのメトリクスが改善しなければrevertします。

## InfiniteScrollの不要な繰り返し判定の除去

`InfiniteScroll` コンポーネントで、スクロール位置が最下部に到達したかの判定を `2 ** 18`（262,144）回繰り返していました。「念の為」というコメントが付いていましたが、`window.innerHeight + Math.ceil(window.scrollY) >= document.body.offsetHeight` は同一イベントハンドラ内では毎回同じ値を返す純粋な比較式なので、繰り返す意味がありません。意図的な妨害コードです。

この判定は `scroll`, `wheel`, `touchmove`, `resize` の4イベントすべてで発火するため、スクロールするたびに26万回のDOM参照と配列生成が走り、TBTを悪化させていました。

```diff
- // 念の為 2の18乗 回、最下部かどうかを確認する
- const hasReached = Array.from(Array(2 ** 18), () => {
-   return window.innerHeight + Math.ceil(window.scrollY) >= document.body.offsetHeight;
- }).every(Boolean);
+ const hasReached = window.innerHeight + Math.ceil(window.scrollY) >= document.body.offsetHeight;
```

## Reactマウントのloadイベント待ち除去

`index.tsx` で `window.addEventListener("load", ...)` の中でReactをマウントしていました。`load`イベントは全リソース（画像、スクリプト、スタイルシート等）の読み込み完了後に発火するため、12MBのJSバンドルのダウンロード＋パースが終わるまで描画が一切始まりません。

```diff
-window.addEventListener("load", () => {
-  createRoot(document.getElementById("app")!).render(
-    <Provider store={store}>
-      <BrowserRouter>
-        <AppContainer />
-      </BrowserRouter>
-    </Provider>,
-  );
-});
+createRoot(document.getElementById("app")!).render(
+  <Provider store={store}>
+    <BrowserRouter>
+      <AppContainer />
+    </BrowserRouter>
+  </Provider>,
+);
```

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.17 | 0.17 |
| FCP | 0.36 | 0.36 |
| LCP | 0 | 0 |

単体では数値に変化なしでした。12MBのバンドルパース時間が支配的で、`load`イベントの待ち時間が誤差に埋もれています。バンドル削減やコード分割と組み合わせることで効果が顕在化する見込みです。変更自体は不要な遅延の除去なので保持しています。

## Tailwind CSSのビルド時コンパイル化

`index.html` で `@tailwindcss/browser@4.2.1` をCDNから同期スクリプトとして読み込み、ブラウザ内でCSSをランタイムコンパイルしていました。外部スクリプトのダウンロード＋パース＋CSSコンパイルがレンダリングをブロックしています。

`@tailwindcss/postcss` を導入してビルド時にCSSを生成するように変更しました。

1. `@tailwindcss/postcss@4.2.1` と `tailwindcss@4.2.1` をdevDependencyに追加
2. `postcss.config.js` に `@tailwindcss/postcss` プラグインを追加
3. `index.html` の `<script src="...@tailwindcss/browser...">` と `<style type="text/tailwindcss">` を除去
4. `<style type="text/tailwindcss">` 内の `@theme`, `@utility markdown`, `@layer base` の定義を `index.css` に移動
5. `index.css` に `@import "tailwindcss"` を追加

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.17 | 0.15 |
| FCP | 0.36 | 0.47 |
| LCP | 0 | 0 |
| CLS | 0.53 | 0.40 |
| render-blocking-resources | 2件 | 1件 |
| unused-javascript | 2件 | 1件 |

FCP が 0.36 → 0.47 に改善しました。CDNからの外部スクリプト読み込みが1件減り、レンダーブロッキングが解消されています。Performanceスコア自体は0.15に下がりましたが、Lighthouseのスコアは実行ごとの変動があるため、個別メトリクスの改善（FCP +0.11、CLS +0.13）を重視します。

## ルートベースのコード分割

全ルートのコンテナコンポーネントが `AppContainer.tsx` に静的importされており、12MBの単一バンドルが生成されていました。ホーム画面の表示に不要な `/crok`（web-llm, katex, react-syntax-highlighter）、NewPostModal（FFmpeg 30.7MB WASM, ImageMagick 13.8MB WASM）なども全て初期ロードに含まれていました。

`React.lazy` + `Suspense` で全ルートコンテナとモーダルを遅延読み込みに変更しました。

```tsx
const TimelineContainer = lazy(
  () => import("@web-speed-hackathon-2026/client/src/containers/TimelineContainer"),
);
// ... 他のルートも同様

<Suspense>
  <Routes>
    <Route element={<TimelineContainer />} path="/" />
    {/* ... */}
  </Routes>
</Suspense>
```

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.15 | 0.23 |
| FCP | 0.47 | ≥0.9 (warning消失) |
| LCP | 0 | 0 |
| render-blocking-resources | 1件 | 0件 (warning消失) |

エントリポイントサイズは12.3 MiB → 462 KiB (96%削減)です。FCPが大幅改善しwarningの閾値を超えました。render-blocking-resourcesも解消しています。ただしタイムラインの描画に必要なチャンクはまだ大きく（5.4MB + 4.2MBなど）、LCPとTTIは依然として0です。次の最適化で個々のチャンクをさらに軽量化する必要があります。

## CoveredImageのネイティブ`<img>`置換

`CoveredImage` コンポーネントが画像表示のために以下の重い処理を毎回実行していました。

1. jQuery.ajaxでバイナリデータをフェッチ
2. `image-size` でサイズを計算（アスペクト比のカバー処理用）
3. `piexifjs` でEXIFからalt（ImageDescription）を抽出
4. Blob URLを生成して `<img>` に渡す

これをネイティブ `<img>` + `object-fit: cover` に置き換えました。EXIFからのalt取得は「ALTを表示する」ボタン押下時のみ動的にインポートして実行するように変更しています。`image-size` は不要になったため初期バンドルから除外されました。

```tsx
<img alt="" className="h-full w-full object-cover" loading={loading} src={src} />
```

`loading` 属性はprops化し、ImageAreaで最初の画像のみ `eager`、2枚目以降は `lazy` に設定しました。

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.23 | 0.23 |
| offscreen-images | 28件 | 1件 |
| uses-responsive-images | 47件 | 34件 |
| lcp-lazy-loaded | - | 解消 |

パフォーマンススコアは変化なしですが、offscreen-imagesが28→1件に大幅減少しました。画像がJS経由ではなくブラウザネイティブで読み込まれるようになり、表示速度が改善しています。LCPはまだ0ですが、LCP画像の発見タイミング（`lcp-discovery-insight`）がSPA構造上の制約で改善しにくいです。

## jQuery → native fetchへの置換

`fetchers.ts` で全HTTPリクエストを `$.ajax({ async: false })` で実行していました。`async: false` は同期XHRであり、リクエスト中はメインスレッドが完全にブロックされます。jQuery自体も ~30KB の不要な依存です。

native `fetch` APIに置き換え、非OK応答（401など）を正しくrejectするように `ensureOk` ヘルパーを追加しました。

`sendJSON` はリクエストボディを `pako` でgzip圧縮し `Content-Encoding: gzip` ヘッダーを付けて送信していましたが、fetch APIでは一部のブラウザ環境で `Content-Encoding` が無視されるかブラウザ自身がデコードしようとする問題があり、スコアリングツールのユーザーフロー計測でDM送信と投稿が失敗しました。リクエストボディは数十バイト〜数KBのJSONで圧縮の恩恵はないため、gzip圧縮を削除しプレーンJSONで送るように変更しました。pako依存も削除しています。

```ts
function ensureOk(response: Response): void {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  ensureOk(response);
  return response.json();
}
```

jQuery (`jquery`, `jquery-binarytransport`, `@types/jquery`) をpackage.jsonから削除しました。rspackの `ProvidePlugin` からも `$` と `window.jQuery` を除去しています。

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.23 | 0.20 |
| エントリポイント | 462 KiB | 377 KiB |
| deprecations failure | あり | 解消 |
| charset failure | あり | 解消 |

パフォーマンススコアは変動の範囲内（0.20-0.23）です。エントリポイントサイズが85KB縮小しました。jQuery由来の非推奨API警告（`deprecations`）も解消されています。

### JQuery.jqXHR型の残存参照を修正

jQuery削除後も `AuthModalContainer.tsx` の `getErrorCode` 関数が引数型に `JQuery.jqXHR<unknown>` を使っており、typecheckが通らなくなっていました。`sendJSON` は既にnative fetchベースで `Error` を throw しますが、サーバーが返すエラーコード（`USERNAME_TAKEN` 等）をレスポンスボディから取得する手段がなくなっていました。

`sendJSON` がエラー時にレスポンスボディを保持する `HttpError` クラスを throw するように変更し、`getErrorCode` を `getErrorMessage(err: unknown, type)` にリネームして `instanceof HttpError` で型を絞り込む形に修正しました。

## web-llmのdynamic import化

`TranslatableText` コンポーネントが `createTranslator` を静的importしており、その依存先の `@mlc-ai/web-llm`（5.38MB）がタイムラインのチャンクに引き込まれていました。翻訳機能はユーザーが「Show Translation」ボタンを押した時にしか使いません。

`createTranslator` のimportをクリック時のdynamic importに変更しました。

```tsx
const handleClick = useCallback(() => {
  // ...
  const { createTranslator } = await import(
    "@web-speed-hackathon-2026/client/src/utils/create_translator"
  );
  using translator = await createTranslator({ ... });
  // ...
}, [state]);
```

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.20 | 0.24 |

web-llmの5.38MBがタイムラインのチャンクから分離され、ホーム画面の初期ロードに含まれなくなりました。

## momentの除去

6コンポーネントで日付フォーマットに `moment`（290KB）を使っていました。使い方は3パターンのみです。

- `moment(date).locale("ja").format("LL")` → 「2026年3月20日」
- `moment(date).locale("ja").fromNow()` → 「3時間前」
- `moment(date).locale("ja").format("HH:mm")` → 「17:30」

`Intl.DateTimeFormat` と `Intl.RelativeTimeFormat` で置き換え、moment依存を削除しました。ランタイムサイズは290KB → 0（ブラウザ組み込みAPIのため追加バンドルなし）です。

計測結果（ホーム画面）:

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.24 | 0.23 |

スコアへの影響は変動範囲内です。momentは既にsplitChunksで別チャンクに分離されていたため、タイムラインの初期表示速度への直接的な影響は小さかったです。

## ReDoS脆弱性の修正

クライアント側の正規表現に3箇所のReDoS（Regular Expression Denial of Service）パターンが仕込まれていました。いずれもネスト量指定子による指数的バックトラッキングが原因です。

1. `auth/validation.ts` — `/^(?:[^\P{Letter}&&\P{Number}]*){16,}$/v` → `/^[\p{Letter}\p{Number}]*$/v`（パスワードの記号チェック）
2. `search/services.ts` — `/since:((\d|\d\d|\d\d\d\d-\d\d-\d\d)+)+$/` → `/since:(\d{4}-\d{2}-\d{2})$/`（日付抽出）
3. `search/services.ts` — `/^(\d+)+-(\d+)+-(\d+)+$/` → `/^\d+-\d+-\d+$/`（日付形式判定。変数名が `slowDateLike` だった）

計測結果:

| ページ | Before | After |
|--------|--------|-------|
| ホーム (`/`) | 0.23 | 0.24 |
| 検索 (`/search`) | - | 0.95 |

Lighthouseの初期ページロード計測ではスコアへの直接的な影響は変動範囲内です。ReDoSはユーザー入力時（フォームバリデーション）に発火するため、TBT/INPのインタラクション計測で効果が出る可能性があります。

## クライアントコードのanti-slop整理

anti-slop-code（AIが生成しがちな冗長パターンの排除）の観点でクライアントコードを見直し、不要な抽象化やデッドコードを除去しました。パフォーマンス改善ではなくコードの簡素化が目的です。

### パススルーコンポーネントの除去

`TimelinePage` は `Timeline` をそのまま返すだけのコンポーネントで、ロジックもスタイリングもありませんでした。`CommentList` も同様で、`comments.map()` → `CommentItem` のみです。それぞれ呼び出し元（`TimelineContainer`, `PostPage`）にインライン化してファイルごと削除しました。

### convertMovieのデッド `size` パラメータ除去

`convertMovie` の `Options.size` は唯一の呼び出し元で `size: undefined` が渡されており、条件分岐（`scale=${size}:${size}`）は到達不能でした。パラメータと分岐を削除し、crop文字列をリテラルに変更しました。

### ensureOkのインライン化

`fetchers.ts` の `ensureOk` は `if (!response.ok) throw ...` の1行を関数化したものでした。各fetcher関数にインライン化し、関数定義を削除しました。

### 一文変数のインライン化

`convert_movie.ts` と `convert_sound.ts` の `const blob = new Blob([output]); return blob;` を `return new Blob([output]);` に統一しました。

### getTokenizerのインライン化

`negaposi_analyzer.ts` の `getTokenizer()` は `analyzeSentiment` から1回しか呼ばれないプライベートヘルパーでした。kuromojiのビルダー生成をインライン化し、不要になった型import（`Tokenizer`, `IpadicFeatures`）を削除しました。

## 動画のGIF→MP4変換

シードデータの動画が全てGIF形式で保存されていました（15ファイル、合計179MB）。GIFは非圧縮に近く、同等品質のMP4と比べて10〜50倍のサイズです。

`PausableMovie` コンポーネントはGIF全体をfetchした後、`gifler` + `omggif` でフレーム単位にデコードしてcanvasに描画していました。メインスレッドでのデコード処理がTBTを悪化させています。

### やったこと

1. シードGIFをFFmpeg CLIでMP4 (H.264) に事前変換するスクリプトを作成。`-movflags +faststart` でmoov atomをファイル先頭に配置し、ダウンロード完了前からストリーミング再生できるようにしました

```bash
ffmpeg -i "$gif" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -an \
  -loglevel warning \
  "$mp4"
```

2. `PausableMovie` コンポーネントをネイティブ `<video autoplay loop muted playsinline>` に置き換え。`gifler`, `omggif` の依存を削除しました

```tsx
<video
  ref={videoRef}
  autoPlay
  className="w-full"
  loop
  muted
  playsInline
  src={src}
/>
```

3. パス変更: `getMoviePath()` の拡張子を `.gif` → `.mp4` に変更
4. サーバー: POST `/api/v1/movies` のバリデーションをGIF→MP4に変更
5. アップロード: `convertMovie` の出力フォーマットをGIF→MP4に変更
6. 元のGIFファイルを削除（179MB削減）

### 計測結果（ホーム画面）

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.22 | 0.25 |
| LCP | 147s | 43s |
| TBT | 6.7s | 2.5s |
| SI | 3.4s | 0.55s |

TBTが6.7s→2.5sに大幅改善しました。GIFのフレームデコード処理（gifler/omggif）がなくなったことでメインスレッドのブロックが62%減っています。LCPも147s→43sに短縮しましたが、まだ全メディアをロードしているため巨大です。

ファイルサイズ: 179MB → 73MB（59%削減）。

## 音声の波形事前計算とビットレート削減

`SoundPlayer` コンポーネントがMP3ファイル全体をfetchし、`SoundWaveSVG` がそのArrayBufferをAudioContextでデコードして波形データ（100本のピーク値）を計算していました。数MBのMP3をダウンロード→デコードする処理がメインスレッドをブロックし、TBTを悪化させています。

また、シードMP3のビットレートが160〜338kbpsと高く、SNS用途には過剰でした（15ファイル、合計66MB）。

### やったこと

1. 波形データをFFmpeg CLIで事前計算するスクリプトを作成。MP3をPCMにデコードし、左右チャンネルの平均→100チャンクのピーク値を算出してJSONとして `public/sounds/waveforms/{id}.json` に保存しました

2. `SoundWaveSVG` のpropsを `soundData: ArrayBuffer` → `soundId: string` に変更。AudioContextでのデコード処理を削除し、波形JSONをfetchする形に変更しました

3. `SoundPlayer` からMP3全体のfetch（`useFetch` + `fetchBinary` + BlobURL生成）を削除。`<audio src>` に直接パスを渡す形に変更しました。これにより `lodash`（`SoundWaveSVG`経由）と `standardized-audio-context`（AudioContext polyfill）の依存も不要になりました

4. シードMP3を128kbpsに再エンコード（66MB → 38MB、42%削減）

### 計測結果（ホーム画面）

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.25 | 0.56 |
| TBT | 2.5s | 49ms |
| SI | 550ms | 501ms |
| LCP | 43s | 42s |
| total-byte-weight | 106MB | 79MB |

TBTが2.5s→49msに劇的改善しました。MP3全体のAudioContextデコードがなくなったことが最大の要因です。Performanceスコアも0.25→0.56に上昇しています。

音声投稿の個別ページでもTBTが448ms→0msに完全解消しました。

## 画像のAVIF変換とリサイズ

シード画像が全て原寸JPEG（4000〜6500px、平均3MB）で配信されていました。投稿画像30ファイル86MB、プロフィール画像30ファイル3.2MB。

競技レギュレーションがChrome最新版のみを対象としているため、WebPではなくAVIFを選択しました。AVIFはChrome 85（2020年）から対応済みで、WebPより圧縮効率が高いです。Baseline APIで確認したところAVIFは2024-01-25にNewly availableになっています。

### やったこと

1. sharpを使って投稿画像を最大幅800px、プロフィール画像を256px（128px × 2 for Retina）にリサイズしつつAVIF (quality 75) に変換するスクリプトを作成しました

```js
await sharp(inputPath)
  .resize({ width: maxWidth, withoutEnlargement: true })
  .avif({ quality: 75 })
  .toFile(outputPath);
```

2. `getImagePath()` と `getProfileImagePath()` の拡張子を `.jpg` → `.avif` に変更
3. 元のJPEGファイルを削除

### 計測結果

**ホーム画面:**

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.56 | 0.56 |
| LCP | 42s | 7.3s |
| total-byte-weight | 79MB | 35MB |
| TBT | 49ms | 0ms |

**画像投稿ページ:**

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.73 | 0.96 |
| LCP | 12.7s | 1.0s |

ファイルサイズ: 投稿画像 86MB → 6.1MB（93%削減）、プロフィール 3.2MB → 416KB（87%削減）。画像投稿ページのLCPが12.7s→1.0sに短縮し、Performanceスコアが0.96に到達しました。

当初は800px幅で変換していましたが、メインコンテンツの最大幅が `max-w-screen-sm` (640px) なので Retina (2x DPR) 端末では不足します。実ユーザーの体験を優先して1280pxに変更しました。サイズは2.7MB→6.1MBに増えましたが、元の86MBから93%削減で十分です。

## メディアのキャッシュヘッダーとcompression除外

メディアファイル（`/images`, `/movies`, `/sounds`）に `Cache-Control` ヘッダーが未設定で、`serve-static` のデフォルト `max-age=0` が適用されていました。また、AVIF/MP4/MP3のようにフォーマットレベルで圧縮済みのバイナリに `compression` ミドルウェアがgzipをかけようとしており、CPUの無駄遣いでした。

### やったこと

1. `/images`, `/movies`, `/sounds` パスに `Cache-Control: public, max-age=86400` を設定
2. `compression` ミドルウェアの `filter` でメディアパスを除外
3. `serve-static` の `cacheControl: false` を設定（デフォルトの `max-age=0` がミドルウェアで設定したヘッダーを上書きしていた）

```ts
// static.ts
for (const path of ["/images", "/movies", "/sounds"]) {
  staticRouter.use(path, (_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  });
}
```

### 計測結果（ホーム画面）

| 指標 | Before | After |
|------|--------|-------|
| Performance | 0.56 | 0.56 |
| LCP | 7.3s | 7.7s |
| TBT | 0ms | 0ms |
| total-byte-weight | 35MB | 40MB |

Lighthouseの単発計測ではスコアに変化なし。キャッシュは2回目以降のナビゲーションで効果が出るため、初回アクセスのみを計測するLighthouseでは差が出にくいです。total-byte-weightの増加は画像を1280pxに変更した分です。

## E2Eテストの修正とクライアントバグの修正

GIF→MP4変換やJPEG→AVIF変換の後、E2Eテストが5件失敗していました。テスト側の不整合3件とクライアント側のバグ2件です。

### テスト側の不整合

1. **動画テスト（2件）**: `PausableMovie` を `<canvas>` (gifler) → `<video>` に置き換えたが、テストは `article canvas` や `button:has(canvas)` を探していた。セレクタを `video` に更新
2. **画像投稿テスト**: シード画像を JPEG→AVIF に変換し元の `.jpg` を削除したが、テストは `.jpg` パスを参照していた。`.avif` に更新

### 投稿モーダルのtextareaバグ

`NewPostModalPage` の textarea に `value` prop がなく、非制御コンポーネントになっていました。Playwright の `fill()` で DOM 値は変わりますが、React の `params.text` ステートが更新されず、投稿ボタンの `disabled={params.text === ""}` が解除されません。実ユーザーの操作でも `onChange` が発火しないケースがあり得るので、`value={params.text}` を追加して制御コンポーネントに修正しました。

### 検索フォームの redux-form 脱却

検索フォームで空のまま検索ボタンを押すと、バリデーションエラーが表示されずにページ遷移してしまう問題がありました。

調査したところ、redux-form 8.3.10 の `handleSubmit` が React 19 + react-redux 9 + redux 5 環境（ピア依存が全て未充足）でバリデーションエラーを無視して `onSubmit` を呼んでいました。ブラウザの `form` submit イベントを監視すると `defaultPrevented: false` で、redux-form がイベントをインターセプトできていません。初期コミットから同じバージョン構成ですが、Rspack 移行で `mode: "production"` になりReactのプロダクションビルドに切り替わったことで挙動が変わったと推測しています。

redux-form の `meta.touched` / `meta.submitFailed` を修正しても根本解決にならないため、検索フォームを redux-form から `useState` ベースのプレーンなフォーム管理に置き換えました。既存の `validate` 関数は submit ハンドラ内で直接呼び出す形にしています。

## 画像ALTテキストのEXIF往復を廃止

手動テスト項目に「画像の EXIF に埋め込まれた Image Description が ALT として表示されること」という要件がありました。調査の結果、既存の実装は以下の流れでした。

1. クライアント: ImageMagick WASM で画像を変換、`img.comment` から EXIF の ImageDescription を取得
2. クライアント: piexifjs で JPEG の EXIF に ImageDescription を書き戻し
3. サーバー: JPEG バイナリをファイル保存（DB に alt は保存しない）
4. 表示時: `CoveredImage` が画像バイナリ全体を再 fetch し、piexifjs で EXIF を読み取り

alt テキストをバイナリメタデータとして往復させている無駄な構造でした。`convertImage` の中で `img.comment` として alt は既に手元にあるのに、EXIF に書き込んで、アップロードして、また取り出している。

さらに、JPEG→AVIF 変換によりシード画像の EXIF が消失し、piexifjs は AVIF を読めないため、`CoveredImage` の ALT 表示が完全に壊れていました。また `getImagePath()` が `.avif` を返すのにアップロード画像は `.jpg` で保存されるため、アップロード画像自体が 404 になる問題もありました。

### 修正内容

alt をデータとして流す方式に変更しました。

1. `convertImage` の戻り値を `Blob` → `{ blob, alt }` に変更。`img.comment` から alt を取得し、piexifjs の EXIF 書き込みを削除
2. `NewPostModalPage` で変換結果の alt を保持し、`NewPostModalContainer` の `sendNewPost` で `images: [{ id, alt }]` として `POST /api/v1/posts` に送信
3. サーバー側は `Post.create` の `include: images` で Image レコードを作成するため、alt が DB に保存される（既存の仕組みをそのまま利用）
4. `CoveredImage` は props で `alt` を受け取り、API レスポンスの値を直接表示。バイナリ fetch と EXIF パースを削除
5. piexifjs (`piexifjs`, `@types/piexifjs`) を依存から削除。`fetchBinary` も不要になったため削除

### シードデータの alt 復元

上記の修正後、「ALT を表示する」モーダルを開くと説明文が空になっていました。DB の `Image.alt` がシードデータで `""` だったため「元から空」と判断しましたが、これは誤りでした。

元の実装は DB の `alt` フィールドを使っておらず、JPEG バイナリの EXIF から直接読み取っていました。piexifjs で元の JPEG を確認すると、全30枚に日本語の ImageDescription が入っていました（例: 「海岸沿いにある大きな岩の上に水着の女性が座っている」）。Python の Pillow では空と出ていましたが、パーサーの違いで結果が異なっていました。

AVIF 変換で EXIF が消失し、新しい API ベースのフローは DB の `alt`（空文字）を読むため、表示が壊れていました。元の JPEG から piexifjs で全 ImageDescription を抽出し、`images.jsonl` に書き込んで `seed:insert` で SQLite に反映しました。

## AspectRatioBox を CSS aspect-ratio に置き換え

`AspectRatioBox` コンポーネントは、JS で `clientWidth` を読み取り `setTimeout(500ms)` 後に高さを計算して `setState` する実装だった。これにより初回レンダリングから 500ms 間コンテンツが非表示になり、高さが 0 から計算値に変わるタイミングで Layout Shift が発生していた。

CSS `aspect-ratio` プロパティに置き換えることで、JS 計算・setTimeout・resize リスナーが不要になり、ブラウザがレイアウト時点でサイズを確定するため CLS が解消される。

使用箇所3箇所（ImageArea: 16/9、PausableMovie: 1/1、SoundPlayer: 10/1）をすべて置き換え、`AspectRatioBox.tsx` を削除した。

```tsx
// Before: JS で高さを計算、500ms 遅延、resize リスナー付き
<AspectRatioBox aspectHeight={9} aspectWidth={16}>
  <div>...</div>
</AspectRatioBox>

// After: CSS aspect-ratio で即座にサイズ確定
<div className="w-full" style={{ aspectRatio: "16 / 9" }}>
  <div>...</div>
</div>
```

| ページ | CLS before | CLS after | Score before | Score after |
|---|---|---|---|---|
| `/` | 0.433 | 0.029 | 0.56 | 0.75 |
| `/posts/fe6712a1...` (画像投稿) | 0.098 | 0.004 | 0.94 | 0.96 |
| `/posts/fff790f5...` (動画投稿) | 0.199 | 0.099 | 0.66 | 0.73 |
| `/posts/fefe75bd...` (音声投稿) | 0.006 | 0.000 | 1.0 | 1.0 |
## フォントの最適化（OTF → サブセット woff2 + font-display: swap）

### 仮説

`/terms`（利用規約）ページで使用されるカスタムフォント「Rei no Are Mincho」が OTF 形式（各6.3MB）で配信され、`font-display: block` が指定されている。フォント読み込み完了までテキストが非表示になり、Lighthouse の simulated throttling（10 Mbps）ではダウンロードに数秒かかるため、LCP に直接影響する。

### 対応

1. TermPage で実際に使われている471文字だけに絞ったサブセットフォントを生成（`pyftsubset`）
2. OTF → woff2 に変換
3. `font-display: block` → `font-display: swap` に変更

### フォントファイルサイズ

| ファイル | Before | After |
|---------|--------|-------|
| Regular | 6.3MB (OTF) | 105KB (subset woff2) |
| Heavy | 6.3MB (OTF) | 104KB (subset woff2) |

98%以上の削減。

### `/terms` ページ Lighthouse 結果

| Metric | Before | After |
|--------|--------|-------|
| FCP | 204ms | 206ms |
| LCP | 645ms | 730ms |
| SI | 204ms | 206ms |
| CLS | 0.018 | 0.019 |
| Score | 100 | 100 |

スコアは100のまま維持。LCP の微増はLighthouseのブレの範囲内。

### 途中経過で得た知見

woff2 変換のみ（サブセットなし、3.7MB）で `font-display: swap` にしたところ、LCP が 645ms → 3,645ms に悪化した。原因は `font-display: swap` によりフォールバックフォントで即座にテキストが描画され（FCP）、カスタムフォント到着後の再描画が LCP として計測されたため。Lighthouse の simulated throttling（10 Mbps）で 3.7MB のダウンロードに約3秒かかり、それが Render Delay としてLCPの97%を占めていた。サブセット化で 105KB まで縮小したことで、swap による再描画のペナルティは消えた。

```css
@font-face {
  font-family: "Rei no Are Mincho";
  font-display: swap;
  src: url(/fonts/ReiNoAreMincho-Regular.subset.woff2) format("woff2");
  font-weight: normal;
}
```

## タイマー系サボタージュコードの除去

`setTimeout` / `setInterval` の使用箇所を調査し、パフォーマンスに悪影響を与えている3箇所を修正した。

### 1. DirectMessagePage の 1ms setInterval → ResizeObserver

**仮説**: DM ページで `setInterval(..., 1)` により `getComputedStyle` を1ms間隔で呼び続けており、強制 reflow が連続発生して TBT/INP に悪影響がある。

**変更前**:

```tsx
useEffect(() => {
  const id = setInterval(() => {
    const height = Number(window.getComputedStyle(document.body).height.replace("px", ""));
    if (height !== scrollHeightRef.current) {
      scrollHeightRef.current = height;
      window.scrollTo(0, height);
    }
  }, 1);
  return () => clearInterval(id);
}, []);
```

**変更後**:

```tsx
useEffect(() => {
  const observer = new ResizeObserver(() => {
    const height = document.body.scrollHeight;
    if (height !== scrollHeightRef.current) {
      scrollHeightRef.current = height;
      window.scrollTo(0, height);
    }
  });
  observer.observe(document.body);
  return () => observer.disconnect();
}, []);
```

`getComputedStyle` は強制レイアウト再計算を引き起こすが、`ResizeObserver` はブラウザのレイアウト完了後にコールバックが呼ばれるため reflow を引き起こさない。また `scrollHeight` はレイアウト情報のキャッシュが使われるため `getComputedStyle` より軽量。

### 2. crok SSE の 3秒 sleep 削除

**仮説**: `/api/v1/crok` の SSE レスポンス開始前に `await sleep(3000)` があり、AI チャットの応答開始が3秒遅延している。意図的なサボタージュコード。

**変更**: `sleep(3000)` を削除。SSE プロトコル（イベント形式）は変更なし。

### 3. crok SSE の 10ms/文字 sleep 削除

**仮説**: 1文字ずつ SSE 送信する際に `await sleep(10)` があり、全文送信に不要な遅延が生じている。

**変更**: `sleep(10)` を削除し、`sleep` 関数自体も除去。1文字ずつイベントとして送信する構造は維持しており、SSE プロトコルは不変。Node.js の I/O バッファリングにより、クライアント側ではストリーミング表示として見える。

### Lighthouse 結果（既存7ページ）

DM ページと crok ページは Lighthouse 計測対象外のため、既存ページでリグレッションがないことを確認。

| ページ | Before | After |
|--------|--------|-------|
| `/` | perf 0.75 | perf 0.75 |
| `/posts/ff93a168` | perf 1.00 | perf 1.00 |
| `/posts/fe6712a1` | perf 0.97 | perf 0.97 |
| `/posts/fff790f5` | perf 0.73 | perf 0.73 |
| `/posts/fefe75bd` | perf 1.00 | perf 1.00 |
| `/search` | perf 0.96 | perf 0.96 |
| `/terms` | perf 1.00 | perf 1.00 |

リグレッションなし。

### 効果が見込まれるページ（スコアリングツール対象）

- `/dm/33881deb-...` (表示100点 + 操作50点): 1ms reflow ポーリング解消により TBT/INP が大幅改善
- `/crok` (操作50点): SSE 応答開始が3秒以上高速化

## 不要ポリフィル・レガシーコードの除去

bluebird、lodash、buffer ポリフィルの3つをクライアントバンドルから除去した。

### 変更内容

1. **bluebird → ネイティブPromise**: `negaposi_analyzer.ts` と `ChatInput.tsx` で `Bluebird.promisifyAll(kuromoji.builder(...))` をネイティブPromiseのコールバックラッパーに置換
2. **lodash → ネイティブArray**: `bm25_search.ts` の `_.zipWith`, `_.filter`, `_.sortBy` を `Array.prototype.map`, `.filter`, `.sort` に置換
3. **buffer ProvidePlugin 削除**: `rspack.config.js` の `ProvidePlugin` で `Buffer` を注入していたが、クライアントコード内に直接の `Buffer` 使用はなく（`ArrayBuffer` のみ）、ビルドも通るため削除

### 計測結果（中央値）

| ページ | メトリクス | Before | After |
|--------|-----------|--------|-------|
| `/` | Performance | 0.75 | 0.76 |
| `/` | SI | 497ms | 325ms |
| `/posts/ff93a168` | Performance | 1.00 | 0.99 |
| `/posts/fe6712a1` | Performance | 0.97 | 0.97 |
| `/posts/fff790f5` | Performance | 0.75 | 0.75 |
| `/posts/fefe75bd` | Performance | 1.00 | 1.00 |
| `/search` | Performance | 0.96 | 0.96 |
| `/terms` | Performance | 1.00 | 1.00 |

トップページのSIが172ms改善。バンドルサイズ削減による初期ロード改善。他ページにリグレッションなし。

## InfiniteScroll を IntersectionObserver に置き換え

### 仮説

`InfiniteScroll` コンポーネントが `wheel`、`touchmove`、`resize`、`scroll` の4つのイベントリスナーを登録し、毎回 `window.innerHeight + scrollY >= document.body.offsetHeight` を同期的に計算していた。イベント発火のたびにメインスレッドが占有されるため、TBTに影響している可能性がある。

### 変更内容

4つのイベントリスナーを `IntersectionObserver` に置き換えた。リスト末尾にセンチネル要素（空の `<div>`）を配置し、それが viewport に入ったときだけ `fetchMore()` を呼ぶ構造にした。

`IntersectionObserver` は Baseline Widely available（2021年〜）で、最新のChromeはもちろん全主要ブラウザで使える。

```tsx
// Before: 4つのイベントリスナー + 手動計算
document.addEventListener("wheel", handler, { passive: false });
document.addEventListener("touchmove", handler, { passive: false });
document.addEventListener("resize", handler, { passive: false });
document.addEventListener("scroll", handler, { passive: false });

// After: IntersectionObserver + sentinel要素
const observer = new IntersectionObserver((entries) => {
  if (entries[0]?.isIntersecting && latestItem !== undefined) {
    fetchMore();
  }
});
observer.observe(sentinel);
```

### 計測結果

`InfiniteScroll` はホーム（`/`）、投稿詳細（`/posts/:id`）、検索（`/search`）、ユーザー詳細（`/users/:id`）の4ページで使われている。

| ページ | メトリクス | Before | After |
|--------|-----------|--------|-------|
| `/` | LCP | 3.8s | 3.8s |
| `/posts/:id` | LCP | 8.2s | 8.2s |
| `/search` | TBT | 30ms | 30ms |
| `/search` | LCP | 1.4s | 1.4s |
| `/users/:id` | TBT | 0ms | 0ms |
| `/users/:id` | LCP | 0.7s | 0.7s |

Lighthouseの数値上は変化なし。TBTが既に30ms以下と小さいため、イベントリスナー削減の効果がLighthouseの計測精度で検出できるレベルではなかった。一方でリグレッションも発生していない。

### 所感

数値的な改善は出なかったが、コードの簡素化という点では意味がある。4つのイベントリスナーの登録・解除と手動のスクロール位置計算が、`IntersectionObserver` の `observe` / `disconnect` だけで済むようになった。実際のユーザー操作ではスクロールイベントの発火頻度はLighthouseの合成テストより高くなるため、実環境での効果はゼロではないと考えている。

## 投稿フォームのバグ修正

### dialog toggle イベントによるフォームリセット

投稿モーダルの `<dialog>` に `closedby="any"` が指定されており、ダイアログの `toggle` イベントリスナーでフォーム状態をリセットしていた。`toggle` は開閉両方で発火するため、テキスト入力後にダイアログが一瞬閉じて再度開くと、入力内容が消えてしまう問題があった。

`toggle` → `close` イベントに変更し、ダイアログが閉じたときだけリセットするようにした。

### React controlled textarea の状態消失

`<textarea value={state} onChange={handler} />` という React の controlled component パターンだと、Playwright のスクリーンショット撮影プロセス中に React の再レンダリングが発生し、textarea の DOM 値と React state の間で不整合が起きる問題があった。

`defaultValue` + `ref` による uncontrolled textarea に変更し、submit 時に `ref.current.value` から値を取得する方式にした。これにより DOM の値が React の re-render に依存しなくなった。

## メディア変換のサーバーサイド移行（試行と断念）

### 仮説

クライアント側の WASM 変換（ImageMagick、FFmpeg）がメインスレッドをブロックし、投稿フローの TBT/INP を悪化させている。

### 試行結果

画像・音声・動画すべてをサーバー側（sharp + ffmpeg）に移行したが、以下の問題で音声・動画は断念してクライアント側に戻した:

1. **fly.io での ffmpeg 変換が遅い**: 9.8MB の WAV → MP3 変換に1分以上かかり、スコアリングツールのタイムアウトを超過
2. **Shift_JIS メタデータの問題**: WAV ファイルの ID3 タグが Shift_JIS でエンコードされており、サーバー側の `music-metadata` では文字化けする。元のクライアントコードでは `encoding-japanese` + FFmpeg WASM でデコードしていた
3. **SharedArrayBuffer の制約**: FFmpeg WASM はマルチスレッド版（`@ffmpeg/core`）を使用しており、`SharedArrayBuffer` が必要。localhost では動くが、fly.io では `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` ヘッダーが未設定のため動作しない。これは Initial Commit の時点から存在する問題

画像変換（ImageMagick WASM → sharp）も一旦 revert した。sharp 自体は動作するが、TIFF の ImageDescription 抽出を EXIF ではなく IFD から直接パースする必要があるなど、追加の複雑さがあった。

## メモリリーク修正

fly.ioでヘルスチェック失敗が発生したため、メモリリークの調査と修正を行った。Lighthouseスコアへの直接的な影響はないが、長時間運用時の安定性に関わる修正。

### 修正内容

1. **express-session MemoryStoreの無制限蓄積** (`server/src/session.ts`): `cookie.maxAge` が未設定で、セッションが永続的に蓄積していた。24時間のTTLを追加して自動期限切れに
2. **WebSocket EventEmitterリスナーリーク** (`server/src/routes/api/direct_message.ts`): `close`イベントのみでリスナーを解除していたが、ネットワーク異常切断時に`close`が発火しない場合リスナーが蓄積する。`error`イベントでも同じcleanup関数を呼ぶように修正
3. **WebSocketServer Mapの保持** (`server/src/utils/express_websocket_support.ts`): `notfound`時にしかMapエントリが削除されなかった。WebSocketの`close`イベントでクライアント数が0になったらMapから削除するように修正
4. **`URL.createObjectURL()`の未解放** (`client/src/utils/load_ffmpeg.ts`): FFmpeg WASMバイナリ用のObject URLが`revokeObjectURL()`されていなかった。ロード完了後に解放するように修正

### 計測結果

Lighthouseスコアは変化なし（初回ページロード計測のため、メモリリーク修正の効果は現れない）。修正の効果は長時間運用時のメモリ安定性として現れる。

| ページ | Before perf | After perf |
|--------|-------------|------------|
| `/` | 0.76 | 0.76 |
| `/posts/ff93a168` | 1.00 | 1.00 |
| `/posts/fe6712a1` | 0.98 | 0.96 |
| `/posts/fff790f5` | 0.75 | 0.75 |
| `/posts/fefe75bd` | 1.00 | 1.00 |
| `/search` | 0.96 | 0.96 |
| `/terms` | 1.00 | 1.00 |

## ホームページLCP画像のpreload注入

ホームページのLCPが3.8秒で、内訳はLoad Delay（ブラウザが画像を発見するまでの遅延）が3,308ms（87%）を占めていました。

原因は、SPAアーキテクチャでJS実行→`/api/v1/me`フェッチ→`/api/v1/posts`フェッチ→React描画という直列チェーンを経て初めて`<img>`タグがDOMに挿入されるため、ブラウザがLCP画像のURLを知るのが遅いことでした。

サーバー側でHTMLを返す際に、DBから最初の画像付き投稿を取得し`<link rel="preload" as="image">`を`<head>`に注入するようにしました。

```typescript
// application/server/src/routes/static.ts
staticRouter.get("/", async (_req, res, next) => {
  const posts = await Post.findAll({ limit: 10, offset: 0 });
  const firstPostWithImage = posts.find((p) => p.images?.length > 0);
  const firstImageId = firstPostWithImage?.images?.[0]?.id;
  // index.htmlの<head>に <link rel="preload" as="image" href="/images/{id}.avif"> を注入
});
```

| メトリクス | Before | After |
|-----------|--------|-------|
| LCP | 3.8s | 3.4s |
| Load Delay | 3,308ms (87%) | 0ms (0%) |
| Render Delay | 339ms (9%) | 3,326ms (96%) |

Load Delayは完全に解消されましたが、ボトルネックがRender Delay（ReactがDOMに画像を挿入するまでの時間）に移動しました。これはクライアント側のレンダリングチェーン（`/api/v1/me`のブロッキング→`/api/v1/posts`フェッチ→React描画）の問題で、別途対応が必要です。

## useInfiniteFetchのサーバー側pagination対応

`useInfiniteFetch`フックがAPI呼び出しのたびに全件取得（2.7MB）してクライアント側で`slice`していました。APIは`limit`/`offset`パラメータに対応しているのに、クライアントが使っていなかったのが原因です。

```typescript
// Before: 毎回全件取得してクライアントでslice
void fetcher(apiPath).then((allData) => {
  data: [...cur.data, ...allData.slice(offset, offset + LIMIT)],
});

// After: サーバー側paginationで必要分だけ取得
const paginatedPath = `${apiPath}?limit=${LIMIT}&offset=${offset}`;
void fetcher(paginatedPath).then((pageData) => {
  data: [...cur.data, ...pageData],
});
```

レスポンスサイズ: 2.7MB → 27KB（1/100）。`useInfiniteFetch`は4箇所で使われているため、タイムライン・検索・ユーザープロフィール・投稿コメント全てに効果があります。

| メトリクス | Before | After |
|-----------|--------|-------|
| LCP | 3.4s | 3.4s |
| Render Delay | 3,326ms | 3,205ms |
| Performance Score | 81 | 82 |

LCPへの直接効果は小さいですが（Render Delayはまだ`/api/v1/me`ブロッキングや lazy chunk loadingが支配的）、全ページで不要な2.7MBの転送を削減する根本的な修正です。

## 未ログイン時の/api/v1/meリクエストスキップ

`AppContainer`は初期化時に必ず`/api/v1/me`をフェッチし、レスポンスが返るまで全ページの描画をブロックしていました。しかし未ログイン時はセッションクッキー（`connect.sid`）が存在しないため、リクエストは必ず401で失敗します。

`document.cookie`に`connect.sid`が含まれるかをチェックし、なければリクエスト自体をスキップして即座にブロッキングを解除するようにしました。

```typescript
const hasSession = document.cookie.includes("connect.sid");
const [isLoadingActiveUser, setIsLoadingActiveUser] = useState(hasSession);
useEffect(() => {
  if (!hasSession) {
    return;
  }
  void fetchJSON<Models.User>("/api/v1/me")
    .then((user) => { setActiveUser(user); })
    .finally(() => { setIsLoadingActiveUser(false); });
}, [hasSession, setActiveUser, setIsLoadingActiveUser]);
```

Lighthouseの計測ではRender Delayへの直接効果は小さかったです（JS実行+React描画自体が支配的なため）。ただし未ログインユーザーに対する不要な401リクエストとネットワークラウンドトリップを削減する正しい最適化です。`saveUninitialized: false`の設定により、未ログインユーザーにはセッションクッキーが付与されないことが前提です。

## Font Awesome SVG sprite の軽量化

Font AwesomeのSVGスプライトファイルが不必要に大きかった。

| ファイル | Before | After | 備考 |
|---|---|---|---|
| solid.svg | 639KB (1002アイコン) | 7.4KB (17アイコン) | 使用アイコンのみ抽出 |
| regular.svg | 107KB (458アイコン) | 1.2KB (1アイコン) | calendar-altのみ使用 |
| brands.svg | 458KB (458アイコン) | 削除 | コード中で未参照 |

合計で約1.2MBから8.6KBへ、**99.3%削減**。

`FontAwesomeIcon`コンポーネント（`FontAwesomeIcon.tsx`）が唯一の参照元で、`iconType`は全箇所リテラル文字列で渡されているため、使用アイコンの洗い出しは静的に完結する。

Lighthouseスコアへの直接的な影響はなかった（Performance: 76 → 76）。これらのSVGファイルはブラウザが`<use xlinkHref>`で参照したときにのみfetchされるため、未使用の1002アイコン分のpath dataがネットワーク転送に含まれていたことが問題の本質。ページ描画のクリティカルパスには入らないが、ネットワーク帯域の無駄遣いを排除した。

## レスポンシブ画像の提供

### 仮説

投稿画像はすべて1280px幅のAVIFで配信されている。タイムラインではCSS Gridで16:9の `object-cover` 表示だが、Lighthouseのデスクトッププリセットでも表示領域は640px程度。画像サイズがLCPのボトルネックになっているはず。

### 実装

サーバー側で `sharp` を使ったオンデマンドリサイズを追加。`/images/{id}.avif?w=640` のようにクエリパラメータで幅を指定するとリサイズ版を返す（320, 640, 960, 1280の4段階）。リサイズ結果はディスクにキャッシュして2回目以降は即座に返す。

クライアント側では `<img>` に `srcSet` と `sizes` を追加。画像1枚表示なら `(max-width: 640px) 100vw, 640px`、複数枚なら `(max-width: 640px) 50vw, 320px` を指定。

preloadタグも `imagesrcset`/`imagesizes` 付きに更新。

```tsx
// ImageArea.tsx
<CoveredImage
  alt={image.alt}
  loading={idx === 0 ? "eager" : "lazy"}
  sizes={images.length === 1 ? "(max-width: 640px) 100vw, 640px" : "(max-width: 640px) 50vw, 320px"}
  src={getImagePath(image.id)}
  srcSet={getImageSrcSet(image.id)}
/>
```

### 結果

画像転送サイズ: 609KB → 71KB（640px版、88%削減）

| 指標 | Before | After | 変化 |
|------|--------|-------|------|
| FCP | 207ms | 210ms | ±0 |
| SI | 284ms | 380ms | +96ms |
| LCP | 3011ms | 566ms | -2445ms (81%改善) |
| Score | 0.83 | 1.00 | +0.17 |

LCPが3秒→0.5秒に改善。Scoreも0.83→1.00になった。

## やらなかったこと

### サーバー側クエリの効率化

以下の無駄なクエリを特定したが、Lighthouseスコア改善に寄与しないため対応しなかった。

- **`POST /signup` の不要な再取得**: `User.create()` 直後の `User.findByPk()` は `reload()` で1クエリ減らせる。ただし signup はスコアリング対象ページの表示に無関係
- **`GET /search` の2回クエリ + JS側マージ**: テキスト検索とユーザー名検索を別クエリで実行し JS で重複排除している。ページネーションが二重適用される構造的な問題もあるが、SQLite ローカルアクセス + シードデータ規模ではクエリ統合のインパクトがミリ秒以下
- **defaultScope への暗黙的な依存**: ルートハンドラ側で `include` を明示していないためスコープ変更時に壊れやすい。コード品質の問題でありパフォーマンスの問題ではない
- **`GET /dm` の全メッセージ eager load**: DM一覧で全会話の全メッセージを読み込んでいるが、DM一覧ページのLighthouseスコアが既に100のため改善余地なし
- **`DirectMessage.afterSave` フックの再取得**: フック引数から取れるデータを `findByPk` × 2 で再取得している。DM送信はページ操作のスコアリング対象だが、DM一覧ページ自体がスコア100のためインパクトが見込めない

## やれなかったこと

- 重量級ライブラリのdynamic import: FFmpeg, ImageMagick, negaposi-analyzerは使う瞬間まで読み込まない
- SharedArrayBuffer を有効にするための COOP/COEP ヘッダー追加（FFmpeg WASM がデプロイ先で動作しない問題の解決）

### 不要ポリフィル・レガシーコードの除去

- **`legacy_createStore` → `configureStore`**: `store/index.ts` でReduxが非推奨化したAPIを使用。ただしredux-formとの依存関係があるため単独での変更は難しい
- **`redux-form` (8.3.10)**: メンテナンス終了済み。auth, search, direct_message, storeの10+ファイルで使用。置き換えは大規模変更になるため優先度は低い

### メディア配信の追加改善

- **プロフィール画像のドミナントカラー事前計算**: `fast-average-color` がクライアントでプロフィール画像を別途読み込んでいる。シードスクリプトで事前計算してDBに保存すれば依存を削除可能

## セッション消失の修正

スコアリングとは直接関係ないが、サインイン後にDM一覧ページなどを開くと認証が切れる問題があった。

### 原因

セッション管理に `express-session` の `MemoryStore` を使っていた。`MemoryStore` はプロセスのメモリ上にセッションを保持するため、サーバーが再起動するとすべてのセッションが消える。

`fly.toml` の設定は `auto_stop_machines = "stop"` かつ `min_machines_running = 0` なので、トラフィックが途切れるとFly.ioのマシンが自動停止する。次のリクエストでマシンが再起動すると `MemoryStore` は空になり、ブラウザのcookieにセッションIDが残っていてもサーバー側に対応するセッションがない状態になる。

### 対策

`express-session` + `MemoryStore` を `cookie-session` に置き換えた。セッションデータがuserIdだけと小さいので、cookieに直接格納する方式が適している。

```ts
// Before
import session, { MemoryStore } from "express-session";
export const sessionStore = new MemoryStore();
export const sessionMiddleware = session({
  store: sessionStore,
  proxy: true,
  resave: false,
  saveUninitialized: false,
  secret: "secret",
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
});

// After
import cookieSession from "cookie-session";
export const sessionMiddleware = cookieSession({
  name: "session",
  keys: ["secret"],
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: false,
});
```

`httpOnly: false` にしているのは、クライアント側でcookieの存在チェック（`document.cookie.includes("session=")`）を行い、セッションがない場合は `/api/v1/me` のリクエストをスキップする最適化のため。

`initialize` エンドポイントの `sessionStore.clear()` も不要になったので削除した。cookie-sessionではサーバー側にストアがないため、DBリセット後に古いcookieのuserIdでユーザーが見つからなければ認証は自然に失敗する。

## 次回以降に活かせるかもしれない知見

### パフォーマンス改善と視覚的正確性を同じワークフローで検証する

今回のレギュレーション違反は、Tailwindランタイム除去後にVRTを回していれば防げた。パフォーマンス改善のワークフローでは「仮説→計測→変更→計測」を徹底し、Lighthouseを毎回回していたのに、VRTは同じ頻度では回していなかった。

パフォーマンスの不変条件に「VRT passes after the change」を追加して、Lighthouseと同じタイミングでVRTも実行する。描画に影響する変更（CSS、コンポーネント構造、アセット形式の変更など）では特に必須。

### ルールの存在と実行は別の問題

CLAUDE.mdに「VRT must pass」と書いてあったのに適用されなかった。パフォーマンス改善のセッションが長時間になると、コンテキスト冒頭のルールへの注意が薄れていく。これはClaude Codeに限らない一般的な問題で、人間でも長時間の集中作業中にチェックリストの項目を飛ばすことはある。

対策は「ルールを書く」ではなく「ルールを強制する仕組みを作る」こと。具体的にはCIにVRTジョブを追加してデプロイ前に自動実行する、Claude Codeのhookでpush/deploy前にVRT実行を割り込ませる、など。ルールをドキュメントに書くだけでは、忙しいときほど機能しない。

### ランタイムを置き換えたら、元の機能が維持されていることを元の動作で検証する

今回のTailwind移行に限らず、JPEG→AVIF変換でEXIFが消失した件も同じ構造の問題だった。ツールやランタイムを別のものに置き換えたとき、「置き換え先が同じ機能を提供する」と仮定してはいけない。元のコードが依存していた挙動を洗い出し、置き換え後もその挙動が維持されているか検証する必要がある。

Tailwindの場合、ビルド時コンパイルは静的にクラス名を抽出する仕組みなので、テンプレートリテラルで動的に組み立てたクラスは原理的に動かない。この制約は事前に分かるものだった。移行時に `grep -r 'bg-\[${' src/` のような確認を挟んでいれば、数秒で見つかった。
