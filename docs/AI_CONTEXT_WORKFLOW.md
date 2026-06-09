# AI Context Snapshot Workflow

本文件說明如何提供 TopChurchPlus 專案資料給內部 Local AI / RTX 主機讀取，同時避免 secret 與正式資料外流。

## 目標

- Local AI 只讀取必要的開發脈絡。
- 不直接分享正式開發 repo。
- 排除 `.env`、token、password、private key、DB dump、測試資料、原始資料、文書範本、`node_modules`。
- 產出的資料夾可設為 Windows / SMB 唯讀分享。

## 預設路徑

正式 repo：

```text
D:\系統開發\topchurchplus
```

AI 讀取快照：

```text
D:\系統開發\topchurchplus-ai-context
```

## 產生 AI context

在正式 repo 執行：

```powershell
.\tools\build-ai-context.cmd
```

此工具會：

- 只複製 `.gs`、`.html`、`.js`、`.json`、`.sql`、`.md`、`.cmd`、`.ps1` 等開發文字檔。
- 只納入 root 入口檔、`api\src`、`api\public`、`database`、`docs`、`tests\api`、`tools`。
- 排除 `.env`、`.clasp.json`、`project-management-export.json`、備份、log、dump、圖片、PDF、測試資料、原始資料、文書範本。
- 在快照中產生 `AI_CONTEXT_MANIFEST.md`。
- 預設將快照中的檔案標成 ReadOnly。

若要先產生可寫入的快照供調試：

```powershell
.\tools\build-ai-context.cmd -NoReadOnly
```

## 建立唯讀分享

先建立或指定一個給 RTX 主機使用的 Windows 帳號，例如：

```text
topchurch_ai_reader
```

用系統管理員身分開啟 PowerShell，執行：

```powershell
.\tools\setup-ai-context-share.cmd -ReaderIdentity ".\topchurch_ai_reader"
```

成功後，RTX 主機可掛載：

```text
\\<開發電腦名稱>\topchurchplus-ai-context
```

## 使用原則

- Local AI / RAG / Open WebUI / AnythingLLM / Continue 應讀取 `topchurchplus-ai-context`，不要直接讀 `topchurchplus`。
- 每次重要功能完成、文件更新或 commit 後，可重新執行 `tools\build-ai-context.cmd`。
- 若 Local AI 需要更多內容，先調整 `build-ai-context.ps1` 的白名單，不要手動複製 secret 或正式資料。
- Local AI 只做分析與搜尋，不直接修改正式 repo、資料庫或部署設定。
