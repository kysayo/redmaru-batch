# redmaru-batch 仕様書

## 概要

Redmineチケットのうち、AI回答（社内AIチャット「MaruCha」による自動回答）が未回答、または古くなっている（鮮度切れ）チケットを検出し、`my-redmaru-app`（Redmine → 社内AIチャット連携のChrome拡張機能）の「AI回答更新」ボタンをPlaywrightで機械的に押して回るためのツール。

## 背景・目的

- `my-redmaru-app` の「AI回答更新」ボタンは、1件のチケットについてAIチャットへの送信・回答待ち・Redmineへの書き戻しまでを自動化する（詳細は `my-redmaru-app` の `docs/SPEC.md` の「AI回答自動更新」節を参照）。ただしこれは**1件ずつ手動でボタンを押す**運用が前提になっている。
- 社内AIチャット（MaruCha）にはAPIが存在せず、認証トークンの扱いも不明なため、API直叩きでの一括処理は断念済み（`my-redmaru-app` の `docs/handoff-ai-answer-automation.md` 参照）。
- そのため、ブラウザ操作を自動化するPlaywrightで拡張機能入りのChromeを操作し、「AI回答更新」ボタンを対象チケットの分だけ機械的に押していく、というアプローチを取る。
- `my-redmaru-app` 側にはPlaywright専用のコードパスを作らない設計方針。バッチ側の完了検知は拡張機能の内部通知に依存せず、Redmine REST APIのポーリングで独立して行う。

## 対象システム

| ロール | 内容 |
|---|---|
| Redmine | `https://misol-dev.cloud.redmine.jp`。チケット一覧取得・鮮度判定・更新検知はすべてREST API経由 |
| 社内AIチャット（MaruCha） | `https://www.marubeni-chatbot.com`。ログインのみ手動、操作は拡張機能のボタン経由 |
| `my-redmaru-app`拡張機能 | 別リポジトリ。ビルド成果物（`.output/chrome-mv3`）をPlaywrightで読み込んで使う |

## 想定運用フロー

RedmineおよびMaruChaへのログインには**二要素承認があり、無人（スケジュール）実行はできない**。そのため「朝1回、手動ログインした状態のブラウザで、その日のうちに処理を完結させ、終わったらブラウザごと閉じる」という単発の対話的セッションを前提に設計している。

「起動」（ブラウザを開いて手動ログインを待つ）と「実行」（実際の処理を行う）は、別プロセス・別コマンドに分離せず、**同一Node プロセス内の別フェーズ**として実装している（`waitForEnter()` でユーザーのEnterキー入力を待って境界を分ける、`src/prompt.ts`）。

検討した代替案（別プロセス化してPlaywrightの `connectOverCDP()` で起動中のブラウザに後から接続する方式）は不採用。理由は実際の使い方が「朝1回で完結、他は何も残らない」であり、プロセスを分ける複雑さに見合わないため。

## アーキテクチャ

### 技術スタック

- Node.js + TypeScript（`tsx` でトランスパイル不要で直接実行）
- Playwright（ブラウザ自動操作）

### ディレクトリ構成

```
redmaru-batch/
├── config.example.json   # 設定の雛形（コミット対象）
├── config.json            # 実際の設定（.gitignore対象、APIキーを含む）
├── docs/
│   └── spec.md             # このファイル
├── README.md               # セットアップ・実行手順
└── src/
    ├── types.ts             # Config・RedmineIssue等の型定義
    ├── config.ts             # config.jsonの読み込み・バリデーション
    ├── customFields.ts       # cf_4588/cf_4589カスタムフィールドの値取得ヘルパー
    ├── duration.ts            # 期間文字列("5m"等)のパース・表示用フォーマット
    ├── staleness.ts           # JST日時パース・鮮度判定ロジック
    ├── redmineClient.ts       # Redmine REST APIクライアント（一覧取得・単一チケット取得）
    ├── browser.ts             # 拡張機能入りPersistent Context起動
    ├── prompt.ts              # 対話的なEnterキー待ち（起動と実行の境界）
    ├── list.ts                # コマンド: 対象チケット一覧（ドライラン）
    ├── checkBrowser.ts        # コマンド: 拡張機能入りブラウザの起動検証
    └── updateOne.ts           # コマンド: チケット1件のボタンクリック＋完了検知
```

### 設定ファイル（config.json）

`chrome.storage.sync` のような拡張機能側の設定とは別に、Node側は `config.json`（gitignore対象）で設定を持つ。

| キー | 説明 |
|---|---|
| `redmine.issuesListUrl` | Redmineのチケット一覧画面で絞り込み（トラッカー・ステータス等）をした状態のURLをそのままコピペする。内部で `/issues` → `/issues.json` に変換して使う（`/projects/xxx/issues` のようなプロジェクト配下のURLにも対応）。列表示用パラメータ（`c[]=...`）が混ざっていてもRedmine APIは無視するので問題ない |
| `redmine.apiKey` | 自分のRedmine APIキー（Redmineの「個人設定」画面で確認できる値）。拡張機能側は `ViewCustomize.context.user.apiKey` から動的取得するが、Node単体では取得元が無いため設定ファイル経由で渡す |
| `staleThreshold` | AI更新日時（`cf_4588`）とチケット更新日時（`updated_on`）の差がこの期間を超えたら「鮮度切れ」とみなす。期間文字列（`src/duration.ts`）で指定する（例: `"1d"`=1日, `"5m"`=5分, `"1h"`=1時間, `"30s"`=30秒）。大規模リリース直後など問い合わせが急増している時期は数分単位に短縮することを想定している。`npm run list` は `--threshold=5m` でコマンドラインから一時的に上書きできる（`config.json` 自体は変更しない） |
| `browser.extensionPath` | `manifest.json` があるフォルダへの絶対パス。**PCごとに実際の場所が変わるので必ず書き換える**（自分のローカルビルド `.output/chrome-mv3` か、チーム配布用に展開したフォルダか） |
| `browser.userDataDir` | Playwright専用のChromeプロファイル保存先（存在しなくても自動作成される）。普段使いのプロファイルとは別の空フォルダにすること |

## 鮮度判定ロジック

`view-customize`リポジトリの `src/script_05.txt`（Redmineチケット詳細ページで鮮度警告を表示するView Customizeスクリプト）と同じ判定条件をNode側で再現している（`src/staleness.ts`）。

1. `cf_4589`（AI回答）が空 → **未回答**（対象）
2. `cf_4589` が空でなく、`cf_4588`（AI更新日時）と `updated_on`（チケット更新日時）の差が `staleDaysThreshold` を超える → **鮮度切れ**（対象）
3. それ以外 → 最新（対象外）

`cf_4588` は `YYYY-MM-DD HH:mm:ss` 形式のJST固定文字列（拡張機能側の `formatDateTimeJst` が生成）。Node実行環境のタイムゾーンに依存させないよう、UTC基準で組み立ててからJSTオフセット（9時間）を引く形でパースしている（`parseJstDatetime`）。

## 実装済みコマンド

### `npm run list`（対象チケット一覧・ドライラン）

`redmine.issuesListUrl` の条件でチケットを全件取得（ページネーション対応）し、鮮度判定した結果をコンソールに一覧表示する。ブラウザ操作は行わない。

### `npm run check-browser`（拡張機能入りブラウザの起動検証）

拡張機能入りのブラウザを起動し、手動ログイン（Enterキーで待ち合わせ）後に以下を自動チェックする。

- 対象チケットの1件（無ければ先頭の1件）のページを開き、ログイン画面にリダイレクトされないか
- 拡張機能の「AI回答更新」ボタン（`#redmaru-ai-answer-btn`）が現れるか

### `npm run update-one -- <チケットID>`（チケット1件の更新）

指定したチケット1件に対して実際にボタンをクリックし、完了を検知する。

1. クリック前に対象チケットの `cf_4588` をRedmine APIで取得し、基準値として保持
2. チケット詳細ページを開き、「AI回答更新」ボタンをクリック
3. Redmine REST APIを5秒間隔・最大150秒ポーリングし、`cf_4588` が基準値から変化したら完了とみなす（拡張機能側の回答生成タイムアウトが90秒のため、余裕を持たせている）
4. タイムアウトした場合は拡張機能側でエラー・タイムアウトが起きている可能性がある旨を表示

完了検知を拡張機能の内部通知（`AUTO_ANSWER_STATUS`）に依存させず、Redmine REST APIのポーリングのみで行っているのは、`my-redmaru-app` 側の設計方針（バッチ専用コードパスを作らない）に合わせたもの。

## 技術的な注意点・ハマりどころ

### system Chromeでは拡張機能が読み込めない

Google Chromeは**バージョン137以降、stable channelで`--load-extension`/`--disable-extensions-except`等のコマンドライン引数による拡張機能読み込みをセキュリティ上の理由で無効化**した（マルウェアがこの仕組みを悪用する被害が多発したための対策）。実機（Chrome 150）で `channel: 'chrome'` を指定して検証したところ、拡張機能が全く読み込まれない（`chrome://extensions` が空）現象を確認した。

**対処**: `channel: 'chrome'` を指定せず、Playwright管理下のChromium（実体はGoogle公式「Chrome for Testing」ビルド、`npx playwright install chromium` で取得）を使う（`src/browser.ts`）。SSO・Windows Hello等の認証がこのビルドでも実際のChromeと同様に動作するかは実機で問題なく確認できている（2026-07-09時点、職場PCでの `update-one` 成功を確認済み）。

### Windowsパスのバックスラッシュ問題

`config.json` はJSONなので、Windowsパスを `C:\Users\xxx\...` のようにバックスラッシュ区切りでそのまま書くと、`\U`や`\D`などがJSONの無効なエスケープシーケンスとして扱われ構文エラーになる。**必ずスラッシュ区切り（`C:/Users/xxx/...`）で書く**こと（Node.jsはWindows上でもスラッシュ区切りのパスを問題なく解釈する）。

### config.example.jsonのダミー値

`browser.extensionPath`・`browser.userDataDir` は当初、開発PC上の実在するパスを例として書いていたが、それが「本物のパスに見えてしまい別PCでの書き換え忘れに気づきにくい」問題を実際に起こした。`YOUR_REDMINE_API_KEY`と同様、明らかにダミーだと分かる値（`REPLACE_WITH_...`）にしている。`loadBrowserConfig()` は起動前に `extensionPath` に `manifest.json` が実在するかチェックし、無ければ分かりやすいエラーを出す。

## 今後の開発（未実装）

- 対象チケット一覧を逐次ループし、`update-one` と同じ処理を複数チケットに対して自動で繰り返す本バッチ処理へ拡張（1タブで逐次処理する方針。並列処理は社内AIチャット側の挙動が未知数なため見送り）

## 関連リポジトリ・ドキュメント

- `my-redmaru-app`（Chrome拡張機能本体）: `docs/SPEC.md`「AI回答自動更新」節、`docs/handoff-ai-answer-automation.md`
- `view-customize`（Redmineチケット詳細ページの鮮度警告表示）: `src/script_05.txt`
