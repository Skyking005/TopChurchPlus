# Synology API

## 建議部署方式

### 方式 A：Container Manager

1. 在 Synology 安裝 `Container Manager`。
2. 建立 Postgres container，或使用 NAS 上既有 Postgres。
3. 將本資料夾 `api/` 放到 NAS，例如 `/volume1/docker/project-api`。
4. 建立 `.env`：

```bash
cp .env.example .env
```

5. 修改 `.env` 的 `DATABASE_URL` 與 `API_KEY`。
6. 安裝並啟動：

```bash
npm install
npm start
```

### 方式 B：Synology 反向代理

若 API 跑在 `http://127.0.0.1:3000`，在 DSM：

`控制台 > 登入入口 > 進階 > 反向代理伺服器`

建議設定：

- 來源：`https://api.your-domain.com`
- 目的地：`http://127.0.0.1:3000`
- 啟用 HTTPS 憑證

Apps Script 的 `UrlFetchApp` 必須能從 Google 伺服器連到你的 API，因此 API 不能只在區網內。建議用 HTTPS 網域、Cloudflare Tunnel、Tailscale Funnel，或 Synology 反向代理加防火牆白名單。

## Apps Script 切換設定

把 `程式碼_api.gs` 作為後端替代目前的 `程式碼.gs`，然後在 Apps Script 執行一次：

```js
setApiConfig('https://api.your-domain.com', 'change_this_long_random_secret')
```

之後前端仍使用 `google.script.run`，但資料會走 Synology API 與 Postgres。
