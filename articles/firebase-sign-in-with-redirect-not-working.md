---
title: Firebase AuthのsignInWithRedirectでログイン後に画面遷移しない問題の原因と解決方法
categories: [技術]
tags: [Firebase, 認証]
publishedAt: 2026-03-19T12:00:00.000Z
revisedAt: 2026-03-19T12:00:00.000Z
---

Firebase Client SDKの `signInWithRedirect` でGoogleログインをした後、リダイレクト先のページにとどまったまま何も起きない問題に遭遇しました。

この記事では、問題の原因と解決方法、加えてデバッグ中に見つかった関連する問題についてまとめます。

## 前提

ログインページの実装は以下のような構成です。

1. ユーザーが「Sign in with Google」ボタンを押すと `signInWithRedirect` でGoogleの認証画面にリダイレクトする
2. Google認証後、ログインページに戻ってきたときに `getRedirectResult` で認証結果を取得する
3. 認証結果からIDトークンを取り出し、バックエンドにPOSTしてcookieを設定する
4. cookieの設定が完了したらホームページに遷移する

```typescript
useEffect(() => {
  async function handleRedirectResult() {
    const result = await getRedirectResult(auth);
    if (result == null) {
      return; // リダイレクト結果がなければ何もしない
    }

    const idToken = await result.user.getIdToken();
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: idToken }),
    });

    if (response.ok) {
      router.push("/");
    }
  }

  handleRedirectResult();
}, [router]);
```

## 問題

Googleの認証画面からログインページに戻ってきた後、ホームページに遷移せずログインページにとどまったままになります。エラーも表示されません。

## 原因

`getRedirectResult` が `null` を返していることが原因です。

`signInWithRedirect` のフローでは、Googleの認証画面からアプリに戻る際、Firebase SDKの `authDomain`（通常 `<project-id>.firebaseapp.com`）でホストされるハンドラページを経由します。このハンドラページからアプリのオリジンに認証結果を受け渡すとき、cross-originの通信が発生します。

Chrome 115以降、3rd party cookieの段階的廃止が進んでおり、`authDomain` とアプリのオリジンが異なる場合、この受け渡しがブラウザにブロックされます。結果として `getRedirectResult` は認証結果を取得できず `null` を返します。

`null` が返ると、コード上は「リダイレクト結果がない（通常のページ表示）」と判定して早期リターンするため、ユーザーから見ると何も起きません。

## 解決方法

`getRedirectResult` の代わりに `onAuthStateChanged` を使います。

`getRedirectResult` はcross-originの通信でリダイレクト結果を受け取るAPIです。一方 `onAuthStateChanged` は、Firebase SDKがIndexedDBに永続化したauth stateの変化を監視するリスナーです。IndexedDBはsame-originのストレージなので、3rd party cookieの制限に影響されません。

`signInWithRedirect` 自体は変更不要です。リダイレクト後にFirebase SDKが内部的にauth stateをIndexedDBに保存するので、`onAuthStateChanged` がその変化を検知してコールバックを呼び出します。

```typescript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user == null) {
      return;
    }

    const idToken = await user.getIdToken();
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: idToken }),
    });

    if (response.ok) {
      router.push("/");
    }
  });

  return unsubscribe;
}, [router]);
```

`/api/auth` へのPOSTはcookieの設定だけを行う冪等な操作なので、既にログイン済みのユーザーが `/login` に来た場合も問題なく動作します。

## 関連して発生した問題

`onAuthStateChanged` への切り替えでログインフローは動くようになりましたが、デバッグ中にもう1つ問題が見つかりました。

### ホームページとログインページの間で無限リダイレクトが発生する

ログイン後にホームページに遷移すると、ホームページのAPIクライアントがバックエンドにリクエストを送ります。このリクエストにはFirebaseのIDトークンを `Authorization` ヘッダーとして付与する必要がありますが、APIクライアントのミドルウェアが `auth.currentUser` を同期的にチェックしていました。

```typescript
// APIクライアントのミドルウェア
async onRequest({ request }) {
  const user = auth.currentUser;
  if (user != null) {
    const token = await user.getIdToken();
    request.headers.set("Authorization", `Bearer ${token}`);
  }
  return request;
},
```

ページ遷移直後はFirebase SDKがIndexedDBからauth stateを復元する前にこのコードが実行されるため、`auth.currentUser` が `null` になります。トークンなしでリクエストが送られてバックエンドが401を返し、401を受けたミドルウェアがログインページにリダイレクトし、ログインページで `onAuthStateChanged` が認証済みユーザーを検知してホームページにリダイレクトし...という無限ループになります。

`auth.authStateReady()` を使うことで解決しました。このメソッドはFirebase SDKの初期化（IndexedDBからのauth state復元を含む）が完了するまでresolveしないPromiseを返します。

```typescript
async onRequest({ request }) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (user != null) {
    const token = await user.getIdToken();
    request.headers.set("Authorization", `Bearer ${token}`);
  }
  return request;
},
```

## まとめ

`signInWithRedirect` + `getRedirectResult` の組み合わせは、Chrome 115以降の3rd party cookie制限によって `authDomain` がアプリと異なるオリジンの場合に動作しなくなります。`onAuthStateChanged` に切り替えることで、cross-originの制限を受けずに認証状態を検知できます。

また、Firebase SDKの初期化は非同期に行われるため、`auth.currentUser` を参照する前に `auth.authStateReady()` で初期化完了を待つ必要があります。これを怠ると、ページ遷移直後にトークンが付与されないリクエストが飛び、意図しない401エラーにつながります。
