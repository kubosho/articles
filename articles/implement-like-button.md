---
title: ブログにいいねボタンを実装した
excerpt: いいねボタンの設計・実装をフロントエンド・バックエンドの両面で解説します。
publishedAt: 2026-01-12
categories:
  - 技術
tags:
  - React
  - Astro
  - TypeScript
  - Cloudflare Workers
---

このブログにいいねボタンを実装しました。以下の構成で実装しています。

```text
LikeButton (UI)
↓
React custom hooks (SWRフック + 楽観的更新、デバウンス + バッファリング)
↓
POST /api/likes/[id] (Astro APIエンドポイント)
↓
PostgreSQL
```

フロントエンドはReactコンポーネントとカスタムフックを組み合わせて、バックエンドはAstroのAPI RoutesとPostgreSQLを使用しています。

## なぜ実装したのか？

ブログ記事を読んだ人から反応が欲しかったからです。

いいね機能は、コメント機能と比較して、読者が手軽に反応を示せる手段だと考えています。読者は「参考になった」「面白かった」という気持ちをワンクリックで伝えられます。また、書き手である自分にとっても、どの記事が読者に響いているかを把握する指標になる可能性があると考えました。

実装にあたって、読者が何度でもいいねできる仕様にしました。ログイン不要で気軽にいいねできる体験を重視したのと、個人のブログなので1人1いいねだといいね数が集まらないと考えたためです。

## 設計方針

### 連打可能にした理由

catnose.meの拍手ボタンやMediumのclapを参考に、何度でもいいねできる仕様にしました。

1人1いいねにする方法（IPアドレス制限、localStorage、フィンガープリントなど）は検討しませんでした。個人ブログのアクセス規模では、1人1いいねだといいね数がほとんど集まらないためです。

### 「完璧さより実用性」という判断基準

このブログでは「いいね数が多少失われても問題ない」という前提で設計しました。

たとえば、いいねのリクエストのリトライキューの実装にlocalStorageではなくsessionStorageを使っています。いいねの送信に失敗しても、このブログでは厳密性を求めてはいないので。それよりも、不要なリトライキューがブラウザに残り続けるリスクを避けることを優先しました。

## フロントエンドの実装

### LikeButtonコンポーネント

いいねボタン用のコンポーネントは、React組み込みのフックやカスタムフックを組み合わせて、ハートアイコンといいね数を表示している構成です。

Astroのコンポーネントでコンポーネントを作らなかった理由は、[Share state between Astro components | Docs](https://docs.astro.build/en/recipes/sharing-state/)というドキュメントを見てAstroで状態を管理するためには外部ライブラリを導入しないといけないと考え、

```tsx
export function LikeButton({ entryId, likeLabel, onClick }: Props): React.JSX.Element {
  // 状態・カスタムフック定義
  const [pulsing, setPulsing] = useState(false);
  const { counts, handleLikes, isLoading } = useLikes({ entryId });
  // ...
```

`pulsing` はクリック時に表示するアニメーション用の状態です。`useLikes` フックではいいねの数と操作用のハンドラーを定義しています。

```tsx
// ...
const handleClick = useCallback(() => {
  handleLikes();
  setPulsing(false);
  requestAnimationFrame(() => {
    setPulsing(true);
  });
  onClick?.();
}, [handleLikes, onClick]);
// ...
```

クリック時には、アニメーションフラグの切り替えに `requestAnimationFrame` を使うことで、アニメーションが毎回実行されるようにしています。

```tsx
  // ...
  return (
    <div className={styles.container}>
      <button type="button" className={styles.button} aria-label={likeLabel} onClick={handleClick}>
        <span className={clsx(styles.like, pulsing && styles.pulse)}>
          {/* ハートアイコンのSVG */}
        </span>
      </button>
      <span className={styles.count} aria-live="polite">{counts}</span>
    </div>
  );
}
```

`aria-live="polite"` を指定することで、いいねをしたときにいいね数をスクリーンリーダーで読まれるようにしています。

### 楽観的UI更新

ユーザーがいいねボタンをクリックした瞬間に、サーバーからのレスポンスを待たずにUIの楽観的更新をしています。

まずSWRを使っていいね数を取得し、バッファリング用のカスタムフックを読み込みます。

```tsx
export function useLikes({ entryId }: UseLikeParams): UseLikeReturn {
  const { data, isLoading, mutate } = useSWR<LikesOnGetResponse | null>(
    `/api/likes/${entryId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const { updateLikeCounts } = useLikesBuffer();
  // ...
```

`revalidateOnFocus: false` と `revalidateOnReconnect: false` を指定することで、タブがフォーカスされた時やネットワーク再接続時の自動再検証を無効化しています。

次に、いいねボタンがクリックされた時のハンドラーを定義します。

```tsx
  // ...
  const handleLikes = useCallback(() => {
    // 即座にUIを更新（楽観的更新）
    void mutate({ id: entryId, counts: countsRef.current + 1 }, { revalidate: false });
    // バッファに追加
    updateLikeCounts(entryId, 1);
  }, [entryId, mutate, updateLikeCounts]);

  return { counts: countsRef.current, handleLikes, isLoading };
}
```

SWRの `mutate` 関数を使ってローカルのキャッシュを即座に更新し、`revalidate: false` でサーバーへの再検証リクエストを抑制しています。同時に `updateLikeCounts` でバッファにいいねを追加し、後でまとめてサーバーに送信します。

### バッファリングによるリクエスト最適化

いいねボタンを連打された場合、クリックごとにAPIリクエストを送信するとサーバーに負荷がかかります。そこで、一定時間内のクリックをバッファリングして、まとめて1回のリクエストで送信するようにしています。

まず、バッファリング用の定数とrefを定義します。

```tsx
const FLUSH_TIMER = 1000; // 1秒

export function useLikesBuffer(): UseLikeBufferReturn {
  const bufferedIncrementsRef = useRef<Map<string, number>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ...
```

`bufferedIncrementsRef` は記事IDごとのいいね数の増分を保持し、`debounceTimerRef` はデバウンス用のタイマーを管理します。

次に、いいね数を更新する関数を定義します。

```tsx
  // ...
  const updateLikeCounts = useCallback((entryId: string, increment: number) => {
    // 現在のバッファに増分を加算
    const currentIncrement = bufferedIncrementsRef.current.get(entryId) ?? 0;
    bufferedIncrementsRef.current.set(entryId, currentIncrement + increment);

    // 既存のタイマーをクリア（デバウンス）
    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current);
    }
    // ...
```

クリックごとにタイマーをリセットすることで、連続クリック中はリクエストを送信せず、クリックが止まってから1秒後に送信されます。

最後に、タイマー発火時にバッファの内容をサーバーに送信します。

```tsx
    // ...
    debounceTimerRef.current = setTimeout(() => {
      const totalIncrement = bufferedIncrementsRef.current.get(entryId) ?? 0;
      bufferedIncrementsRef.current.delete(entryId);
      void sendLikes(entryId, totalIncrement);
    }, FLUSH_TIMER);
  }, []);

  return { updateLikeCounts };
}
```

たとえば、1秒以内に5回クリックされた場合、5回のリクエストではなく `increment: 5` という1回のリクエストにまとめられます。

### リトライキューによるオフライン対応

ネットワークエラーでリクエストが失敗した場合、sessionStorageにリトライキューとして保存しています。

```tsx
export function saveToRetryQueue(entryId: string, increment: number): void {
  const storage = getStorage();
  if (storage == null) return;

  const queue = loadRetryQueue();
  queue.push({ entryId, increment, timestamp: Date.now() });
  storage.setItem(LIKE_SEND_RETRY_QUEUE_KEY, JSON.stringify(queue));
}
```

ページを再読み込みした際にリトライキューを読み込み、失敗したリクエストを再送信します。sessionStorageを使用しているため、タブを閉じると自動的にクリアされます。

## バックエンドの実装

### データベーススキーマ

いいね数を保存するテーブルは、Drizzle ORMを使って下記のように定義しています。

```tsx
export const likes = pgTable('likes', {
  id: serial('id').primaryKey(),
  entryId: varchar('entry_id', { length: 255 }).notNull().unique(),
  counts: integer('counts').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

記事ID（entryId）にはユニーク制約を付けており、記事ごとに1レコードとなります。

### APIエンドポイント

AstroのAPIルートを使って、GET（取得）とPOST（更新）のエンドポイントを実装しています。

```tsx
// GET: いいね数の取得
export async function GET({ locals, params, request }: APIContext): Promise<Response> {
  const { id } = params;
  if (!isValidEntryIdFormat(id)) {
    return createClientErrorResponse({ type: 'invalidEntryId' });
  }

  const exists = await entryExists(id);
  if (!exists) {
    return createClientErrorResponse({ type: 'entryNotFound' });
  }

  const counts = await getLikeCounts({ context: locals, entryId: id });
  return new Response(JSON.stringify({ id, counts }), { status: 200 });
}
```

### いいね数の更新（Upsert）

いいね数の更新には、PostgreSQLのON CONFLICT DO UPDATE（Upsert）を使用しています。

```tsx
export async function incrementLikeCounts({ context, entryId, increment }: IncrementParams): Promise<number> {
  const db = getDbClient(context);

  const result = await db
    .insert(likes)
    .values({ counts: increment, entryId })
    .onConflictDoUpdate({
      target: [likes.entryId],
      set: {
        counts: sql`${likes.counts} + ${increment}`,
        updatedAt: new Date(),
      },
    })
    .returning({ counts: likes.counts });

  return result[0]?.counts ?? 0;
}
```

レコードが存在しない場合は新規作成、存在する場合はcountsを加算するという処理を1回のクエリで実行できます。

### Cloudflare Cache APIによるキャッシュ

GETリクエストの結果はCloudflare Cache APIを使ってエッジでキャッシュしています。

```tsx
const cache = locals.runtime?.caches?.default ?? null;
const cacheKey = createNormalizedCacheKey(request);

const cachedResponse = await cache?.match(cacheKey);
if (cachedResponse != null) {
  return new Response(await cachedResponse.text(), {
    status: cachedResponse.status,
    headers: cachedResponse.headers,
  });
}
```

POSTリクエストでいいね数が更新された際には、該当するキャッシュを削除して次回のGETで最新値が取得されるようにしています。

## セキュリティ対策

セキュリティ対策の一部は、AIエージェントに指摘されて追加しました。自分だけでは見落としていた観点です。

入力値のバリデーションと記事IDの検証は、AIエージェントからの指摘で「確かに実装しないとゴミデータが増えたり、不正にいいね数が増えすぎたりする」と認識しました。AIを使ったコードレビューは、セキュリティの抜け漏れを防ぐのに有効だと感じました。

### レート制限

Cloudflare WorkersのRate Limiting APIを使って、短時間での大量リクエストを制限しています。

```tsx
export async function checkRateLimit({ clientIp, entryId, rateLimiter }: Params): Promise<boolean> {
  try {
    const rateLimitKey = JSON.stringify({ clientIp, entryId });
    const { success } = await rateLimiter.limit({ key: rateLimitKey });
    return !success;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return false;
  }
}
```

レート制限のキーには、クライアントIPと記事IDを組み合わせて使用しています。これにより、同じクライアントIPからの連打は制限しつつ、異なるクライアントIPからは同じ記事にいいねできるようにしています。

### 入力値のバリデーション

リクエストボディのバリデーションにはValibotを使用しています。

```tsx
export const likesOnPostRequestSchema = object({
  increment: pipe(
    number(),
    integer(),
    minValue(1, 'Increment must be at least 1'),
    maxValue(MAX_INCREMENT_VALUE, `Increment must be at most ${MAX_INCREMENT_VALUE}`),
  ),
});
```

incrementの値は1以上100以下の整数に制限しています。これにより、1回のリクエストで大量のいいねを不正に追加されることを防いでいます。

### 記事IDの検証

存在しない記事IDに対するリクエストを弾くため、記事IDの形式チェックと存在確認を行っています。

```tsx
// 形式チェック：英小文字、数字、ハイフンのみ許可（1〜50文字）
const MAX_ENTRY_ID_LENGTH = 50;
const ENTRY_ID_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function isValidEntryIdFormat(id: string | undefined): id is string {
  if (id == null || id === '' || id.length > MAX_ENTRY_ID_LENGTH) {
    return false;
  }
  return ENTRY_ID_PATTERN.test(id);
}

// 存在確認：AstroのgetEntryでO(1)ルックアップ
export async function entryExists(entryId: string, getEntryFn: GetEntryFn): Promise<boolean> {
  const entry = await getEntryFn('entries', entryId);
  return entry !== undefined;
}
```

形式が不正な場合は400エラー、存在しない記事の場合は404エラーを返します。これにより、データベースへのゴミデータ挿入を防いでいます。

## まとめ

いいねボタンの実装では、下記の点を意識しました。

- 楽観的UI更新による即時フィードバック
- バッファリングによるAPIリクエストの最適化
- キャッシュとUpsertによるデータベース負荷の軽減
- レート制限と入力値バリデーションによるセキュリティ対策

また、個人ブログという規模に合わせた設計判断も重要でした。

- 連打可能にすることで、少ないアクセス数でもいいねが集まりやすくなる
- sessionStorageを使うことで、不要なデータの残留を防ぐ
- AIエージェントを活用したコードレビューで、セキュリティの抜け漏れを防ぐ

規模や要件に応じて「完璧さより実用性」を選ぶ判断も、設計の一部だと考えています。

ブログに軽量ないいね機能を追加したい方の参考になれば幸いです。
