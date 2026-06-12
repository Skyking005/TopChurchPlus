收到！這兩處修正非常精準，特別是將「直接關聯並依賴」改寫為「**以 `Pastoral Member` 作為唯一身份主體**」，完美避開了 ORM 或資料庫層級「所有資料表都必須強制 Foreign Key 到 `pastoral_members`」的過度耦合誤區，保留了未來不論是透過微服務 Service 呼叫、Event 驅動、還是 Read Model（如 CQRS 讀寫分離）的實作彈性。

以下為最終修正並定稿的 **`IDENTITY_BOUNDARY_V2.md`**：

---

# Architecture Design Document: Identity Boundary V2

## 1. 設計目標 (Design Objectives)

`IDENTITY_BOUNDARY_V2` 的核心目標在於**徹底解耦 TopChurchPlus 的「系統管理後台（System Administration）」與「牧養事工端（Pastoral）」兩大領域的身份體系**。

為了避免未來的開發人員或 AI 協作工具將「後台管理權限」與「會友/牧者身份」混淆，本架構確立了「管理權限與牧養身份完全分離」**與**「牧養單一身份（Single Identity）」的鐵律。後台管理中心具備對全系統資源的維護權，但絕對不可作為牧養端的身份來源；而所有面對會友與牧養領袖的功能，皆必須收攏於單一的牧養身份主體之下。

* **管理權限與身份解耦**：管理帳號（Account）僅代表後台系統的「操作權力」，而不具備、也不代表任何牧養體系中的身份。
* **牧養身份單一化（Single Identity）**：取消「會友」與「同工/牧者」在系統底層的帳號類型拆分。不論職分高低，所有人在牧養領域皆為同一個實體，僅透過動態關係鑑權。
* **單向維護與零身份依賴**：系統後台中心具備最高維護權限，但後台認證上下文（Authentication Context）與前端牧養認證完全隔離。

---

## 2. 系統架構圖 (System Architecture Map)

未來不論是人類工程師或 AI 進行系統擴展，皆必須嚴格遵守以下架構邊界與實體層級：

```text
TopChurchPlus
│
├─ Administrative Domain (System Administration Layer)
│  │
│  └─ Account (後台管理身份，不代表任何牧養身份)
│      ├─ System Settings (系統參數與安全審計)
│      ├─ EDM Management (電子報與推播建立)
│      ├─ Event Management (活動建立與報名管理)
│      ├─ Course Management (全教會課程建立與上架)
│      ├─ Attendance Maintenance (點名資料修正與覆核)
│      └─ Line Bot Management (LINE 機器人回應與設定)
│
└─ Pastoral Domain (Pastoral & Member Ecosystem)
    │
    ├─ Line User (外部社群身份入口)
    │   │
    │   ▼ (OAuth2 綁定)
    │
    └─ Pastoral Member (牧養領域唯一身份主體)
        ├─ Member (一般會友)
        ├─ Small Group Leader (小家長)
        ├─ Area Leader (大家長)
        ├─ Zone Pastor (區長 / 區牧)
        ├─ Pastor (處長 / 牧師)
        └─ Future Positions (未來任意擴展之職分)
            │
            ▼
        [ Dynamic Relationship-Based Permission ]
        (依職分 Position、組織關係 Relationship、課程資格 Qualification 動態鑑權)

```

---

## 3. Domain Definition (領域定義)

### Administrative Domain

Administrative Domain 是 TopChurchPlus 的 **System Administration Layer（系統管理層）**。其職責為維護與管理整個系統資源，包含 Pastoral Domain 所需之基礎資料與營運資料。**Administrative Domain 管理系統，但不代表牧養身份。**

* **Accounts (系統帳號)**：專用於後台管理中心的登入、認證與操作實體。代表的是對系統資源的控制權，而非教會會友個體。

### Pastoral Domain

Pastoral Domain 是服務會友與各級牧養領袖的運作生態圈。其內部僅包含唯一的身份核心與外部入口：

* **Pastoral Member (牧養會友資料)**：**Pastoral Member 為牧養領域唯一身份主體。** 一般會友與各級牧養領袖（小家長、大家長、區長、區牧、處長、牧師）皆屬於 Pastoral Member，僅是職分與權限範疇不同。
* **LINE Users (LINE 身份入口)**：作為 Pastoral Domain 的外部身份入口，與 `Pastoral Member` 建立唯一的綁定關係，是前端（LINE Bot / LIFF）與系統連結的唯一管道。

---

## 4. Administrative Domain (後台管理中心規範)

System Administration Layer 擁有對整個 TopChurchPlus 系統資源的最高維護與全局控制權，其運作邊界如下：

* **核心實體**：`Accounts`。
* **API 命名空間**：後台管理與資源維護介面嚴格限制在 `/api/admin/*`。
* **治理與維護範圍**：
* 負責在後台完成：課程建立、EDM 建立、活動建立、LINE Bot 設定、點名資料修正、牧區組織資料維護。


* **邊界限制**：後台中心雖可直接存取與維護 Pastoral 系統的基礎與營運資料，但 **Account 絕對不能成為 Pastoral Domain 的身份來源**。後台的操作皆屬系統管理行為，不產生 any 牧養身份上下文。

---

## 5. Pastoral Domain (牧養事工端規範)

Pastoral Domain 是一個由「單一身份」驅動、由「屬靈職分與關係」動態鑑權的封閉生態圈：

* **核心實體**：`Pastoral Member` 與 `LINE Users`。
* **API 命名空間**：所有面對會友與牧養領袖的功能，嚴格限制在 `/api/pastoral/*`。
* **動態功能解鎖機制**：
* **一般會友端 (LINE Bot / LIFF)**：透過 LINE 身份入口進入，取得教會相關資訊與個人化服務。例如：閱讀 EDM、獲取活動報名連結、QT 訂購、聚會資訊、修讀課程資訊等。
* **各級牧養領袖端 (職分特權功能)**：小家長、大家長、區長、區牧、處長、牧師等，可在牧養端解鎖一般會友不可見的管理功能。例如：執行牧區/小組點名、操作牧區培育系統、以及課程結業狀態查看等。


* **邊界限制**：此領域功能旨在服務會友與牧養領袖，**絕對不具備、也無法取得後台管理中心的任何系統級（Administrative）管理權限**。

---

## 6. Permission Model (權限模型)

本系統全面落實「後台行政 RBAC」與「牧養端動態關係」雙軌完全分離的權限架構：

### 後台管理中心權限 (Administrative Permissions)

* **認證標的**：僅針對後台 `Accounts`。
* **授權模式**：基於角色的存取控制（RBAC）。後台帳號依據配置的角色，直接對後台資源（含牧養營運資料）進行 CRUD 維護。此權限止步於後台，**絕對禁止延伸至前端牧養操作**。

### 牧養端功能權限 (Pastoral Permissions)

* **認證標的**：以 **Line User → Pastoral Member** 的綁定關係為唯一識別基準。
* **授權模式**：**系統透過職分（Position）、組織關係（Relationship）、課程資格（Qualification）動態決定其可使用之功能。**
* 牧養端不劃分後台的 Admin Role。
* 當 `Pastoral Member` 發起請求時（如小組點名），系統動態解析其在組織架構中的「關係」（是否為該小組的家長）與「職分」（是否具備點名權限），嚴格限制其資料檢視範圍。



---

## 7. 架構原則與未來擴展 (Architectural Principles)

為因應下一階段的 **LINE Bot、牧區點名、培育系統、結業資格、課程權限、QT 系統、報名系統** 等模組開發，特此制定以下不可動搖的擴展原則：

> 💡 **Core Principle: Pastoral Member is the Single Identity of all pastoral-facing features.**
> 所有面對會友與牧養領袖的模組（All member-facing modules），必須且僅能透過 **Line User → Pastoral Member** 進行身份驗證與鑑權。
> **系統中禁止再建立第二套會員或身份系統。** 未來不論開發何種新型態的會友端應用，其底層認證與個體識別，全部必須收攏並認同 `Pastoral Member` 實體。

---

## 8. 禁止事項 (Prohibited Practices)

1. **禁止建立 Identity Mapping 表**：系統中**嚴格禁止建立 `account_member_mapping**` 或任何試圖將後台 `Account` 與 `Pastoral Member` 進行身份綁定的對照表。
2. **禁止雙向身份推導**：
* 程式碼中絕對不得包含「透過後台登入的 `Account` 推導出特定 `Pastoral Member` 身份」的邏輯。
* 程式碼中亦不得包含「透過前端 `Pastoral Member` 逆向查找或賦予其後台 `Account` 權限」的邏輯。


3. **禁止以 Account 作為牧養操作的主體來源**：後台中心可以全權維護牧養資料，但後台 `Account` 的 Session、Token 或帳號實體，絕對不可傳入牧養端作為行為的「身份主體（Identity Source）」。
4. **禁止共用或衍生第二套會員實體**：任何面向會友與牧養領袖的新模組（如培育、QT、報名、點名），若需要識別使用者，必須以 `Pastoral Member` 作為唯一身份主體。禁止自行建立第二套 `User`、`Customer`、`AppMember` 或其他會員身份表。

---

*文件版本：v2.2 (架構彈性與定稿版)* *維護團隊：TopChurchPlus 系統架構設計小組*