# 2026-06-05 系統整體回歸測試

## 測試範圍

- 測試帳號：the.king.of.sky@gmail.com（杜建恩）
- 測試環境：NAS API `http://192.168.3.2:3000`
- 測試資料前綴：
  - `DEMO-REG-20260605-20260605142009`
  - `DEMO-REG-20260605-FOLLOW-20260605142248`
  - `DEMO-REG-20260605-LINK-*`
- 測試檔案來源：`D:\系統開發\topchurchplus\測試資料`
- 測試方式：以 API 進行系統互動測試，Demo 資料保留，不刪除。

## 通過項目

- 核心與系統管理
  - `/health` 正常。
  - `/initial-data` 可載入帳號與參數資料。
  - `/params/departments` 可讀取部門參數。
  - `/system/users?page=1&pageSize=20` 可讀取使用者清單。
  - `/system/feature-permissions` 可讀取功能權限。
  - `/usage` 可記錄模組使用紀錄。

- 登入與安全驗證
  - 未知帳號登入會被拒絕。
  - 陌生裝置以 `deviceId` 登入會要求驗證。
  - 使用驗證碼完成 `/login/verify` 後，同一 `deviceId` 再登入可通過。

- 牧養系統
  - 可讀取牧養選項。
  - 新增會友必填驗證有效。
  - 已建立 Demo 會友並上傳會友照片與新人資料圖片。
  - 同名檢查可回傳資料。
  - 會友詳情與更新可正常執行。
  - 清單搜尋與 `pageSize=20` 可執行。
  - Demo 會友：`11258`

- 專案管理系統
  - 新增專案必填驗證有效。
  - 已建立 Demo 專案、查詢清單、查詢詳情。
  - 已建立會議、更新會議、完成會議。
  - 已上傳會議 PDF 附件。
  - Demo 專案：`20260613`
  - Demo 會議：`M2026060005`

- 財務系統
  - 新增採購單必填驗證有效。
  - 已建立專案採購並上傳報價單 PDF。
  - 採購詳情可讀取報價單資料。
  - 已建立預借、支出證明、請款單、獨立請款、請款關聯支出證明。
  - 請款清單 `pageSize=20` 可執行。
  - 採購單可結案。
  - Demo 採購單：`P2026060009`
  - Demo 請款單：`R2026060006`
  - Demo 支出證明：`E2026060008`

- 表單系統
  - 新增表單必填驗證有效。
  - 已建立公開收費表單，包含圖片上傳題。
  - 公開表單可讀取。
  - 外部回覆可提交圖片附件。
  - 回覆清單與統計資料可讀取。
  - Demo 表單：`6d125631-95d8-4e81-82c1-9e383d36f624`
  - Demo 回覆：`2b33a599-af2c-47f5-9a2a-1a34e081731e`

- 櫃台工作台
  - 可新增 PIN Code。
  - PIN Code 清單可讀取。
  - PIN Code 可登入櫃台工作台。
  - 已測試已繳費與待繳費交易清單。
  - Demo PIN Code：`8GQBNT`

- 資產管理系統
  - 資產清單排序與 `pageSize=20` 可執行。
  - 已新增位置。
  - 新增資產必填驗證有效。
  - 已新增與更新資產。
  - 已讀取資產詳情。
  - Demo 位置：`9e944447-6695-4e26-af26-670c83e163c6`
  - Demo 資產：`DEMO-REG-20260605-FOLLOW-20260605142248-ASSET`

- 場地預約系統
  - 可讀取場地資源清單。
  - 可設定場地可借用。
  - 可設定場地 calendar id。
  - 可讀取可借用場地與預約清單。

- QT 管理系統
  - 可讀取 QT 選項。
  - 已新增庫存入庫異動。
  - 可查詢庫存檢查。
  - 已測試跨會堂庫存調撥。
  - 可讀取庫存、異動、訂單與領取報表。

- QRCode 報到系統
  - 可讀取選項與活動清單。
  - 已新增 Demo 報到活動。
  - 已用會友 QRCode 字串報到。
  - 重複報到會回傳既有結果，不會重複新增。
  - Demo 活動：`4ea4be13-a91e-46d3-a90e-4b6c4f18e08d`

- 教育管理系統
  - 可讀取課程分類。
  - 新增課程必填驗證有效。
  - 已新增、查詢、更新課程。
  - Demo 課程：`139`

- LINE BOT 管理系統
  - `/linebot/dashboard` 可讀取。

- 個人工作日誌
  - 新增工作日誌必填驗證有效。
  - 已新增 3 筆工作日誌。
  - 工作日誌清單 `limit=20` 可讀取。

- 跨系統關聯
  - 已用財務請款單 `R2026060006` 轉出 Demo 資產。
  - `/entity-links` 可查到 finance payment_request → asset asset 的 `converted_to_asset` 關聯。
  - Demo 轉資產：`DEMO-REG-20260605-LINK-1780669700764-ASSET`

## 未完全自動驗證項目

- 會議邀請寄信
  - `clasp run sendMeetingInvite` 已能透過 Node spawn 正確傳遞參數，但 Apps Script CLI 回覆 `Script function not found. Please make sure script is deployed as API executable.`
  - 未自動寄出測試信。
  - 已保留 Demo 專案 `20260613` 與 Demo 會議 `M2026060005`，與會者僅有杜建恩，可在 UI 觸發寄信，只會寄給本人帳號。

## 測試中修正的測試器假設

- 讀取 API 的 `x-current-user` 必須是 base64url JSON，不是 URL encoded JSON。
- 登入裝置欄位為 `deviceId`，不是 `deviceFingerprint`。
- 財務 API 正式路徑為 `/purchases`、`/payment-requests`，不是 `/finance/...`。
- 場地 API 正式路徑為 `/venues/...`。
- 工作日誌 API 正式路徑為 `/work-logs`，欄位為 `logDate`、`workItem`。
- QT 庫存 API 使用 `churchId`、`issueMonth`、`productType`。
- QRCode 活動欄位為 `eventName`。
- 更新資產與課程時需送完整必要欄位，不能只送狀態。

## 建議後續

- 將這次 API 回歸測試整理為可重複執行的測試腳本，並加入固定工具流程。
- 補一個 Apps Script 可執行的測試入口，專門測 `sendMeetingInvite`，避免每次只能靠 UI 手動確認。
- 表單收費回覆這次未產生 `counterTransactionId`，建議再檢查表單收費欄位與櫃台交易建立條件是否與 UI payload 完全一致。
