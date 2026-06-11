# TopChurchPlus Project State

最後更新：2026-06-11

## 專案階段

目前階段：

Phase 2：核心系統建置、資料搬移與 NAS 部署驗證

---

## 已完成模組

### Core

狀態：可正式使用

已完成：

* 權限系統
* 角色功能權限矩陣
* 參數系統
* 編碼規則管理
* Audit Log / Usage Log
* 檔案管理
* Entity Link / Domain Event
* API Key 保護
* NAS API 部署流程

待改善：

* 部分中文舊檔案仍有 mojibake 顯示
* 部分 routes.js 尚未拆分 service 層

---

### Project

狀態：可正式使用

已完成：

* 專案清單
* 專案詳細
* 專案權限
* 專案收支預算
* 會議記錄
* Word / PDF 會議紀錄附件
* 專案編號前綴 PJ

待改善：

* 專案儀表板
* 文件管理與版本化
* 專案報表

---

### Meeting

狀態：Beta

已完成：

* 功能入口
* 獨立會議清單
* 獨立會議新增
* 專案會議清單整合
* 會議編號規則

待改善：

* 獨立會議編輯
* 獨立會議附件
* 會議通知整合

---

### Forms

狀態：可正式使用

已完成：

* 表單建立
* 公開填寫
* 表單回覆
* 表單統計
* 收費表單與櫃台交易整合
* 公開表單短連結
* 短連結管理搬移至表單系統

待改善：

* 表單權限細分
* 表單匯出報表

---

### Short Links

狀態：可正式使用

已完成：

* 短碼產生
* 目標網址管理
* 點擊紀錄
* 過期與停用狀態
* 管理者以上層級操作限制

---

### Pastoral

狀態：Beta

已完成：

* 會友主檔
* 會友照片與新人表附件
* 牧區架構
* 牧養權限
* 關懷紀錄
* 會友 ID 對外編碼 TOP
* MSSQL 會友匯入邏輯

待改善：

* 會友報表
* 重複會友合併流程
* LINE 綁定驗證流程

---

### Education

狀態：Beta

已完成：

* 課程分類
* 課程管理
* 學員修課狀態
* 培育進程預估
* 課程 ID 對外編碼 CL
* MSSQL 課程匯入邏輯

待改善：

* 講師與班表
* 教育報表
* 匯入後資料抽樣驗證

---

### Finance

狀態：Beta

已完成：

* 採購
* 預借
* 請款
* 支出證明
* 採購與專案關聯
* 財務文件匯出

待改善：

* 財務報表
* 預算分析
* 簽核流程細化

---

### Asset

狀態：開發完成

已完成：

* 資產主檔
* 位置管理
* 狀態管理
* 資產來源連結

待驗證：

* 正式匯入 797 筆資產資料
* 資產盤點流程

---

### Venue Reservation

狀態：Beta

已完成：

* 場地資源
* 場地預約
* 週曆檢視
* 衝突檢查

待改善：

* 場地核准流程
* 場地通知

---

### Zoom

狀態：可正式使用

已完成：

* Zoom 帳號管理
* Zoom 預約
* 時段衝突檢查

---

### Attendance

狀態：Beta

已完成：

* 聚會統計 API
* 小家出席統計
* 近期出席狀態
* MSSQL 點名匯入設計

待改善：

* UI 報表強化
* 出席趨勢圖
* 正式資料同步排程

---

### Line Bot / LIFF

狀態：串接準備完成

已完成：

* LINE Channel 基礎資料表
* LIFF 會友入口
* LINE webhook receiver
* Webhook smoke test
* LINE webhook URL 設定為 `https://api.topchurchplus.com/linebot/webhook`
* Channel Secret 已寫入 DB
* Webhook signature mode 目前為 `log_only`

待外部條件：

* 防火牆開通 WAN TCP 80 / 443 到 NAS
* HTTPS 憑證與反向代理最終測試
* LINE Webhook 正式驗證

---

### QT

狀態：Beta

已完成：

* QT 訂購
* QT 庫存
* QT 領取
* 舊系統 QT 匯入腳本

待改善：

* 月份報表
* 庫存盤點

---

### Qrcode / Counter

狀態：Beta

已完成：

* QRCode 活動
* QRCode 報到
* 櫃台 PIN 登入
* 櫃台待繳費交易
* 表單收費整合

待改善：

* 櫃台日結
* 支付方式報表

---

### Dev Management

狀態：可正式使用

已完成：

* 開發 Issue
* 版本紀錄
* 文件入口
* 系統開發管理入口

待改善：

* 自動產生 release note
* 部署狀態自動回寫

---

## 進行中

### NAS / External Access

目前進度：

* NAS API container 正常運作
* API health check 正常
* GoDaddy `api.topchurchplus.com` A record 已指向外部 IP
* DSM reverse proxy 已建立
* 內網 Host header 測試通過
* 外網 HTTPS 尚待防火牆與憑證確認

---

### MSSQL Migration

目前進度：

* 會友匯入邏輯已支援 TOP 對外編碼
* 課程匯入邏輯已支援 CL 對外編碼
* QT 匯入邏輯已存在
* Attendance 匯入設計已存在
* MSSQL 仍保留為過渡資料源

---

## 下一個優先項目

1. 完成 HTTPS / 防火牆 / LINE webhook 外部測試
2. 聚會統計系統 UI 與正式同步排程
3. 教育系統講師與班表
4. 會議管理編輯與通知
5. 資產正式資料匯入驗證
6. 財務報表與預算分析

---

## 技術債

高優先：

* Script_Login.html 過大
* Project routes.js 承載過多會議與專案邏輯
* 部分中文檔案存在 mojibake 顯示
* 部署 SQL migration 尚未整合進 deploy-api 流程

中優先：

* Apps Script 與 API 職責需要重新整理
* params 可逐步遷移至更結構化的 param_items
* 短連結 UI 目前由系統管理 DOM 搬移到表單系統，後續可獨立成元件
* API smoke test 覆蓋率不足

低優先：

* 前端樣式與元件命名可再統一
* 部分舊匯入 generated SQL 可改為可重建產物

---

## 近期重大決策

* 保留 Google Apps Script 為主要前端
* PostgreSQL 為未來主資料庫
* MSSQL 暫時保留為過渡與同步來源
* 使用 NAS Docker 作為內部 API 執行環境
* 採漸進式重構，不一次性重寫前端
* 會友與課程保留整數主鍵，新增 TOP / CL 對外編碼
* 專案編號因既有欄位為文字，直接遷移為 PJ 前綴
* LINE webhook 在外部 HTTPS 完成前以準備模式運作
