# 旅遊獎勵轉讓公告板

這是一個可以部署到 Cloudflare Pages 的公司內部旅遊獎勵轉讓公告板。一般同仁不需要註冊、不需要密碼、不需要 Email，只輸入員工編號即可刊登或管理自己的公告。管理員才需要登入。

平台只提供公告刊登與瀏覽，不處理付款、議價、匯款、成交確認或買方登記。因為一般同仁只用工號操作，正式啟用時建議只把網址提供給公司內部同仁使用，不要公開散播。

## 功能

- 公開公告列表：顯示刊登中且未過期的公告，不顯示員工編號。
- 我要刊登：輸入員工編號後自動帶出姓名、單位、國家。
- 管理我的公告：同仁可修改、標記已售出、下架、重新刊登舊公告。
- 管理員後台：查看全部公告、依狀態/國家/關鍵字篩選、修改、下架、恢復公告。
- 得獎名單匯入：支援 CSV，也支援從 Excel 複製表格後直接貼上。
- 資料庫初始化：管理員登入後按按鈕建立資料表，不需要手動跑 SQL。
- 操作紀錄：記錄員工編號、操作、公告 ID、IP、瀏覽器資訊與時間。

## 檔案結構

```text
public/
  index.html
  post.html
  my.html
  admin/
    login.html
    index.html
    winners.html
    setup.html
  assets/
    style.css
    app.js

functions/
  _lib/
  api/
    listings.js
    winner.js
    my-listings.js
    auth/
      login.js
      logout.js
      me.js
    listings/[id]/
      update.js
      sold.js
      close.js
      republish.js
    admin/
      setup.js
      listings.js
      import-winners.js
      audit-logs.js
      settings.js
      listings/[id]/
        update.js
        close.js
        restore.js

test-data/
  winners-sample.csv
docs/
  ACCEPTANCE_TESTS.md
  ADMIN_RUNBOOK.md
  EMPLOYEE_ANNOUNCEMENT.md
README.md
.env.example
.gitignore
wrangler.toml.example
```

## Cloudflare 部署設定

Cloudflare Pages 建置設定：

```text
Framework preset: None
Build command: 留空
Build output directory: public
Functions directory: functions
```

## 上線步驟

1. 建立 GitHub repository，例如 `travel-reward-board`。
2. 把這個專案放到 repository，並推送到 GitHub。
3. 到 Cloudflare 建立 D1 database，建議名稱：`travel_reward_board`。
4. 到 Cloudflare Workers & Pages 建立 Pages 專案，連接 GitHub repo。
5. Pages 設定 Build output directory 為 `public`。
6. 到 Pages 專案 Settings > Bindings 新增 D1 database。
7. D1 binding 的 Variable name 一定要填 `DB`。
8. 到 Settings > Variables and Secrets 新增：
   - `ADMIN_USERNAME`：Text，例如 `admin`
   - `ADMIN_PASSWORD`：Secret，請自行設定管理員密碼
   - `ADMIN_SESSION_SECRET`：Secret，請填一長串亂碼
   - `LISTING_EXPIRE_DAYS`：Text，預設 `7`
9. 重新部署 Cloudflare Pages。
10. 打開 `/admin/login.html`，用管理員帳密登入。
11. 打開 `/admin/setup.html`，按「初始化資料庫」。
12. 打開 `/admin/winners.html`，匯入得獎名單。
13. 回首頁測試刊登、管理我的公告、已售出與下架流程。

## 得獎名單格式

支援英文欄位：

```csv
employee_no,name,unit,country
A001,王小明,業務一處,日本
A002,李小華,北區單位,韓國
```

也支援中文欄位：

```csv
員工編號,姓名,單位,國家
A001,王小明,業務一處,日本
A002,李小華,北區單位,韓國
```

可以使用 `test-data/winners-sample.csv` 測試。

## 營運文件

- 管理員操作手冊：[docs/ADMIN_RUNBOOK.md](docs/ADMIN_RUNBOOK.md)
- 給同仁的公告文字：[docs/EMPLOYEE_ANNOUNCEMENT.md](docs/EMPLOYEE_ANNOUNCEMENT.md)
- 正式上線驗收清單：[docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md)
- Wrangler 範例設定：[wrangler.toml.example](wrangler.toml.example)

## 測試流程

1. 初始化資料庫。
2. 匯入 `test-data/winners-sample.csv`。
3. 到 `/post.html` 輸入 `ZZ999`，應顯示查無得獎資料。
4. 到 `/post.html` 輸入 `A001`，應帶出王小明、業務一處、日本。
5. 填寫售價、是否可議價、聯絡方式後送出。
6. 首頁應看到公告，但不會顯示員工編號。
7. 再用 `A001` 刊登一次，應提示已有刊登中的公告。
8. 到 `/my.html` 輸入 `A001`，可修改、標記已售出或下架。
9. 到 `/admin/index.html`，應可看到所有狀態與操作紀錄。

## 固定名稱

- D1 binding：`DB`
- 管理員帳號：`ADMIN_USERNAME`
- 管理員密碼：`ADMIN_PASSWORD`
- 管理員登入密鑰：`ADMIN_SESSION_SECRET`
- 公告有效天數：`LISTING_EXPIRE_DAYS`
- 管理員入口：`/admin/login.html`
