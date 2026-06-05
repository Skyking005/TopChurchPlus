# topchurchplus Core Platform

這份文件定義 topchurchplus 後續模組共用的底層方向。現階段採漸進式調整，不重寫既有專案、財務、牧養、資產系統。

## Core 範圍

已開始落地：

- API 模組化骨架：`api/src/app.js`、`api/src/middleware/*`、`api/src/modules/core/*`
- API 共用層：`api/src/shared/*`，集中使用者解析、系統功能權限、參數讀取、日期與 CSV 格式化
- Auth 模組：`api/src/modules/auth/routes.js`，集中登入、陌生裝置驗證、登入紀錄
- System 模組：`api/src/modules/system/routes.js`，集中 initial data、使用者管理、權限管理、參數、使用紀錄
- Pastoral 模組：`api/src/modules/pastoral/routes.js`，集中牧養選項、會友清單、會友詳細資料與會堂資料範圍權限
- Asset 模組：`api/src/modules/asset/routes.js`，集中資產清單、資產詳細/儲存、位置清單與位置管理
- Finance 模組：`api/src/modules/finance/routes.js`，集中採購、預借、支出證明與請款申請 API
- Project 模組：`api/src/modules/project/routes.js`，集中專案清單、專案詳細、會議紀錄與專案權限 API
- 結構化參數表：`param_categories`、`param_items`
- 共用檔案管理表：`files`、`file_links`
- 稽核紀錄表：`audit_logs`
- 會友/Line 外部身份橋接：`member_accounts`、`line_users`

暫時保留：

- `params` 舊參數表仍是現有前端主要資料來源。
- `role_feature_permissions` 仍是系統入口權限主表。
- 各模組內部資料範圍權限仍由各模組各自維護，例如 `project_permissions`、`account_pastoral_church_permissions`。

## API 模組化規範

新模組建議放置：

```text
api/src/modules/<module>/
  routes.js
  service.js
  repository.js
  mapper.js
  validators.js
```

共用能力放置：

```text
api/src/middleware/
api/src/shared/
api/src/modules/core/
```

現階段 `api/src/index.js` 仍保留大部分既有路由。後續每次開新功能時，優先將該模組新路由放到自己的 `routes.js`，再逐步搬離 `index.js`。

已採用的入口組裝模式：

```js
const app = createApp();

app.use(createApiKeyMiddleware({ publicPaths: ['/health'] }));
registerCoreRoutes(app);
registerAuthRoutes(app);
registerSystemRoutes(app);
registerPastoralRoutes(app);
registerAssetRoutes(app);
registerFinanceRoutes(app);
registerProjectRoutes(app);

// 新系統模組註冊在這裡，不再把路由直接寫回 index.js

app.use(createErrorHandler());
```

路由模組規則：

- `routes.js` 只註冊 HTTP endpoint 與處理 request/response。
- 商業邏輯逐步放到 `service.js`。
- SQL 存取逐步放到 `repository.js`。
- 資料欄位轉換逐步放到 `mapper.js`。
- 輸入檢查逐步放到 `validators.js`。
- 錯誤統一丟出 `Error`，由 `createErrorHandler()` 回傳 JSON。

## 參數管理建議

使用混合式：

- 純下拉選項放 `param_categories` + `param_items`
- 有屬性、關聯、統計需求者獨立成主資料表

獨立表範例：

- `churches`
- `accounts`
- `pastoral_groups`
- `asset_locations`
- 未來 `venues`

短期策略：

- 新參數可開始寫入 `param_items`
- 舊功能仍讀 `params`
- 等前端與 API 都改完後，再考慮停用 `params`

## 檔案管理規範

所有模組檔案先進 `files`，再用 `file_links` 掛回業務資料。

範例：

```text
files.file_id = <uuid>
file_links.entity_type = pastoral_member
file_links.entity_id = 11255
file_links.file_type = newcomer_photo
```

適用：

- 牧養新人照片、紙本新人單、受洗照片
- 財務收據、發票、請款附件
- 資產照片、保固文件
- 專案匯出 DOC、附件
- 表單與場地申請附件

## LOG 策略

目前已存在：

- `system_usage_logs`：使用行為、常用模組排序

新增：

- `audit_logs`：敏感資料異動紀錄

建議保留策略：

- `system_usage_logs`：保留 180-365 天
- `audit_logs`：依資料敏感度保留 3-7 年

為避免 NAS 壓力，使用紀錄可輕量記錄；稽核紀錄先從權限、財務、牧養等敏感操作開始。

## Line / 會友外部入口

內部同工身份與外部會友身份分開：

- `accounts`：同工
- `member_accounts`：會友入口身份
- `line_users`：Line Bot 綁定身份

會友入口原則：

- 只能操作自己的資料或申請
- 不沿用同工後台權限
- 所有外部入口 API 另設 middleware 與權限檢查

## 新系統開發原則

每個新系統開發前先定義：

- 系統入口權限
- 模組內資料範圍權限
- 是否需要檔案
- 是否需要 audit log
- 是否需要 Line / 會友入口
- 是否有下拉參數或主資料表

這樣場地、表單、教育、敬拜、服事等系統可以掛在同一個底座上。
