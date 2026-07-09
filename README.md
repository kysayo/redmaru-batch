# redmaru-batch

Redmineチケットのうち、AI回答（`cf_4589`）が未回答、または回答日時（`cf_4588`）に対してチケットが一定日数以上更新されている「鮮度切れ」チケットを検出するバッチツール。

`my-redmaru-app`（Redmine → 社内AIチャット連携のChrome拡張機能）の「AI回答更新」ボタンを、Playwrightで機械的に押して回るバッチ処理の一部として作成中。現時点では **対象チケットの抽出・一覧表示（ドライラン）**、**拡張機能入りブラウザの起動検証（`check-browser`）**、**チケット1件を指定してのボタンクリック＋完了検知（`update-one`）** まで実装済み。複数チケットを自動で順次処理するループはまだ未実装。

## セットアップ

```
npm install
npx playwright install chromium
cp config.example.json config.json
```

`npx playwright install chromium` は初回のみ必要（Playwright管理下のChromiumをダウンロードする。理由は後述）。

`config.json` を編集する。

| キー | 説明 |
|---|---|
| `redmine.issuesListUrl` | Redmineのチケット一覧画面で絞り込み（トラッカー・ステータス等）をした状態のURLをブラウザのアドレスバーからそのままコピペする |
| `redmine.apiKey` | 自分のRedmine APIキー（Redmineの「個人設定」画面で確認できる値） |
| `staleThreshold` | AI回答日時とチケット更新日時の差がこの期間を超えたら「鮮度切れ」とみなす。期間文字列で指定（例: `"1d"`=1日, `"5m"`=5分, `"1h"`=1時間, `"30s"`=30秒） |
| `browser.extensionPath` | `manifest.json` があるフォルダ（`my-redmaru-app` のビルド成果物 `.output/chrome-mv3`）への絶対パス。**PCごとに実際の場所が変わるので必ず書き換えること**（下記参照） |
| `browser.userDataDir` | Playwright専用のChromeプロファイル保存先。**普段使いのChromeプロファイルとは別の空フォルダを指定すること**（排他ロックで競合するため）。初回はここに手動でRedmine・社内AIチャットのSSOログインをしておく |

**Windowsのパスを書くときは `\`（バックスラッシュ）ではなく `/`（スラッシュ）区切りにすること**（例: `C:/Users/xxx/Downloads/chrome-mv3`）。JSONでは `\` はエスケープ文字として扱われるため、`\U`や`\D`のようなWindowsパスそのままの記述はJSON構文エラーになる。Node.js（Windows）は `/` 区切りでも問題なくパスを認識する。

`browser.extensionPath` はPC・状況によって実際の値が変わる。`config.example.json` には書き換え忘れに気づけるようダミー値を入れてあるので、必ず自分の環境の実パスに置き換えること。

- 自分のPCで `my-redmaru-app` をclone・ビルドして使う場合: そのclone先の `.output/chrome-mv3`（例: `E:/Projects/my-redmaru-app/.output/chrome-mv3`）
- `docs/SPEC.md` の「ビルド成果物の配布」に従ってGitHub ReleasesのzipをDLして展開した場合: 展開先フォルダ（`manifest.json` が直下にあるフォルダ）

指定したパスに `manifest.json` が無い場合はエラーで教えてくれる。

## 実行

### 対象チケット一覧（ドライラン）

```
npm run list
```

対象チケット（未回答 or 鮮度切れ）の一覧がコンソールに表示される。

`staleThreshold` はコマンドラインで一時的に上書きできる（`config.json` の値は変更しない）。

```
npm run list -- --threshold=5m
```

大規模リリース直後などで問い合わせが急増している時にだけ短い閾値で回す、といった使い方を想定している。

### 拡張機能入りブラウザの起動検証

```
npm run check-browser
```

`browser.userDataDir` を使って拡張機能入りのChromium（Playwright管理下・`npx playwright install chromium`で取得したもの）をheaded起動する。

1. ブラウザが開いたら、そのウィンドウ上でRedmineと社内AIチャット（MaruCha）に**手動で**ログインする（二要素承認があるため無人ログインは不可。毎回このステップが必要）
2. ログインが終わったら、コマンドを実行しているターミナルでEnterキーを押す
3. 続けて以下を自動チェックする
   - 対象チケット一覧の中から1件（無ければ先頭の1件）のチケット詳細ページを開き、ログイン画面にリダイレクトされないか（＝ログインセッションを認識できているか）
   - 拡張機能の「AI回答更新」ボタン（`#redmaru-ai-answer-btn`）がページに現れるか（＝拡張機能が正しく読み込まれているか）

ブラウザウィンドウを閉じるとプロセスが終了する。

### チケット1件を指定してのAI回答更新（実際にボタンをクリックする）

```
npm run update-one -- <チケットID>
```

例: `npm run update-one -- 49523`

1. ブラウザが開いたら、Redmineと社内AIチャットに手動ログインし、ターミナルでEnterキーを押す（`check-browser`と同じ）
2. 指定したチケットの現在のAI更新日時（`cf_4588`）をRedmine APIで取得（クリック前の基準値として保持）
3. チケット詳細ページを開き、「AI回答更新」ボタンをPlaywrightでクリック
4. Redmine REST APIを5秒間隔・最大150秒ポーリングし、`cf_4588`がクリック前の値から変化したら完了とみなす（`my-redmaru-app`拡張機能側の回答生成タイムアウトが90秒のため、余裕を持たせた値）
5. タイムアウトした場合は拡張機能側でエラー・タイムアウトが起きている可能性があるので、ブラウザ側の表示を確認する

ブラウザウィンドウを閉じるとプロセスが終了する。

## なぜsystem Chromeではなく`npx playwright install chromium`が必要か

Google Chromeはバージョン137以降、stable channelで`--load-extension`等のコマンドライン引数による拡張機能読み込みをセキュリティ上の理由で無効化した。実機（Chrome 150）で検証したところ、`channel: 'chrome'`を指定すると拡張機能が全く読み込まれないことを確認したため、Playwright管理下のChromium（実体はGoogle公式「Chrome for Testing」ビルド）を使っている（`src/browser.ts`）。

## 想定している運用フロー

二要素承認のため無人（スケジュール）実行は前提にしない。**朝1回、手動ログインした状態のブラウザで、その日のうちにバッチ処理を完結させ、終わったらブラウザごと閉じる**という単発の対話的セッションを想定する。「起動」（ブラウザを開いて手動ログインを待つ）と「実行」（実際の処理を行う）を同一プロセス内の別フェーズとして扱う（`waitForEnter` で境界を分ける、`src/prompt.ts`）。

## 今後の予定（未実装）

- 対象チケット一覧を逐次ループし、`update-one`と同じ処理を複数チケットに対して自動で繰り返す本バッチ処理へ拡張
