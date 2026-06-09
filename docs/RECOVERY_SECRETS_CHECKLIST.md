# TopChurchPlus 復原私密資料保管檢查表

最後更新：2026-06-09

## 目的

本文件只列出災難復原時必須能取得的私密資料與存放責任，不記錄任何實際密碼、token、API key、private key 或連線字串。

使用方式：

1. 超級管理員每月確認下列項目仍可取得。
2. 實際值需保存在安全位置，例如密碼管理器、加密檔案、NAS 權限控管資料夾或實體密封備份。
3. 若任一項目只存在單一電腦，需視為高風險。
4. 若異動任何 token、密碼或 key，需更新本檢查表的「最後確認日期」欄位，但不要把實際值寫入本文件。

## 保管原則

- 不把 secret commit 到 GitHub。
- 不在聊天、issue、commit message、文件中貼出完整 secret。
- 最少保留兩個可授權取得的人或位置，避免單點失效。
- 優先使用具備存取紀錄的密碼管理器或 NAS 權限控管資料夾。
- 每次人員異動、供應商異動、Google/LINE/NAS 管理者異動後，需重新確認。

## 核心系統私密資料

| 項目 | 用途 | 建議保管位置 | 負責角色 | 最後確認日期 | 備註 |
| --- | --- | --- | --- | --- | --- |
| NAS 管理員帳號 | DSM、Container Manager、檔案與備份管理 | 密碼管理器 / 實體密封備份 | 超級管理員 | 待填 | 不記錄密碼 |
| NAS SSH 帳號 | 自動部署、Docker 指令、備份檢查 | 密碼管理器 | 超級管理員 | 待填 | 例如部署用帳號 |
| SSH private key | 本機部署到 NAS | 加密備份；本機路徑 `%USERPROFILE%\.ssh\project_api_deploy` | 超級管理員 | 待填 | 不可進 Git |
| NAS API `.env` | API 啟動與資料庫連線 | NAS 權限控管備份 / 密碼管理器附件 | 超級管理員 | 待填 | 對應 `/volume1/docker/project-api/.env` |
| 本機 API `.env` | 本機測試與 smoke test | 加密備份 | 開發管理者 | 待填 | 對應 `D:\系統開發\topchurchplus\api\.env` |
| API_KEY | Apps Script / 測試工具呼叫 NAS API | 密碼管理器 | 超級管理員 | 待填 | 可在 `.env` 中還原 |
| PostgreSQL 帳號密碼 | DB 備份、還原、migration | 密碼管理器 | 超級管理員 | 待填 | 不記錄連線字串 |
| PostgreSQL 最新備份位置 | DB 還原 | NAS `/volume1/docker/project-api/backups/` | 超級管理員 | 待填 | 每月確認最近 30 天內有備份 |

## Google / Apps Script

| 項目 | 用途 | 建議保管位置 | 負責角色 | 最後確認日期 | 備註 |
| --- | --- | --- | --- | --- | --- |
| Apps Script 擁有者 Google 帳號 | 發佈與授權 Web App | 密碼管理器 / Google Workspace 管理 | 超級管理員 | 待填 | 需能登入 |
| clasp 登入權限 | 重新 push Apps Script | 可重新登入的 Google 帳號 | 開發管理者 | 待填 | 新機需 `clasp login` |
| Apps Script Deployment ID | 維持固定 Web App URL | GitHub `.clasp.json` / `push-to-google.cmd` | 開發管理者 | 待填 | 不屬於 secret，但需可查 |
| Google Drive 文件輸出資料夾權限 | 舊文件流程或過渡期輸出 | Google Drive 權限管理 | 超級管理員 | 待填 | 文件產出逐步移至 NAS |

## LINE / LIFF / 外部入口

| 項目 | 用途 | 建議保管位置 | 負責角色 | 最後確認日期 | 備註 |
| --- | --- | --- | --- | --- | --- |
| LINE Channel Secret | LINE Webhook / LIFF 驗證 | 密碼管理器 | 超級管理員 | 待填 | 不可寫進 repo |
| LINE Channel Access Token | LINE API 呼叫 | 密碼管理器 | 超級管理員 | 待填 | 可輪替 |
| LIFF ID / Channel ID | LIFF app 設定 | 系統管理介面 / 密碼管理器 | 超級管理員 | 待填 | ID 可記錄，secret 不可 |
| Rich Menu 設定資料 | Line App 會友入口 | DB / 系統管理介面 | 系統管理者 | 待填 | 圖片檔需另備份 |
| 外部短連結設定 | 表單、活動、LINE 入口 | DB / 系統管理介面 | 系統管理者 | 待填 | 需能重建對應關係 |

## 網域 / 對外連線

| 項目 | 用途 | 建議保管位置 | 負責角色 | 最後確認日期 | 備註 |
| --- | --- | --- | --- | --- | --- |
| 網域管理帳號 | `topchurchplus.com` forwarding / DNS | 密碼管理器 | 超級管理員 | 待填 | 未確認前不可修改 |
| NAS 對外 IP / Port forwarding 設定 | API 對外連線 | IT 文件 / NAS 設定截圖 | IT / 超級管理員 | 待填 | IP 可能變動 |
| SSL / 反向代理設定 | 未來 HTTPS API | NAS / DNS / Cloudflare 文件 | IT / 超級管理員 | 待填 | 若啟用需補文件 |

## 檔案與附件

| 項目 | 用途 | 建議保管位置 | 負責角色 | 最後確認日期 | 備註 |
| --- | --- | --- | --- | --- | --- |
| NAS API `files` 目錄 | 上傳附件、產出文件 | NAS 備份任務 | 超級管理員 | 待填 | 對應 `/volume1/docker/project-api/files` |
| 文書範本 | DOCX/PDF 產出 | GitHub / NAS / 原始資料夾 | 秘書部 / 開發管理者 | 待填 | 模板異動需同步 |
| 測試資料 | 系統整體測試 | 本機或 NAS 權限控管資料夾 | 開發管理者 | 待填 | 不進 Git |
| 教會品牌素材 | 登入與文件品牌 | NAS 媒體部資料夾 / Git 管理副本 | 媒體部 / 開發管理者 | 待填 | 權限需確認 |

## 每月人工確認

每月維護時，除執行：

```powershell
.\tools\check-rebuild-readiness.cmd -RunSmoke
```

也需人工確認：

1. 至少一位超級管理員能取得 NAS 管理權限。
2. 至少一位超級管理員能取得 Google Apps Script 擁有者帳號。
3. SSH private key 有安全備份，且不是只存在單一本機。
4. `.env` 有安全備份，且可辨識是正式 NAS API 的版本。
5. 最近 30 天內有 PostgreSQL 備份。
6. LINE / LIFF token 可在需要時輪替或重新設定。
7. NAS `files` 目錄與文書範本有備份策略。

若任一項不確定，請在系統開發管理建立 `maintain` issue。
