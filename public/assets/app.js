const page = document.body.dataset.page;
const fixedCountries = ["日本", "韓國", "泰國", "越南"];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function negotiableText(value) {
  return value === "yes" || value === 1 ? "可議價" : "不可議價";
}

function setMessage(el, message, type = "") {
  if (!el) return;
  el.textContent = message || "";
  el.className = `status-message ${type}`.trim();
}

const demoWinners = {
  A001: { employee_no: "A001", name: "王小明", unit: "業務一處", country: "日本" },
  A002: { employee_no: "A002", name: "李小華", unit: "北區單位", country: "韓國" },
  A003: { employee_no: "A003", name: "陳大明", unit: "南區單位", country: "泰國" },
  A004: { employee_no: "A004", name: "林美玲", unit: "客服中心", country: "越南" },
};

function isLocalPreview() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function demoReadListings() {
  return JSON.parse(window.localStorage.getItem("travelRewardDemoListings") || "[]");
}

function demoWriteListings(listings) {
  window.localStorage.setItem("travelRewardDemoListings", JSON.stringify(listings));
}

function demoNow(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function demoSeedListing() {
  const listings = demoReadListings();
  if (listings.length) return listings;
  const seeded = [
    {
      id: 1,
      employee_no: "A001",
      price: 25000,
      negotiable: "yes",
      contact: "分機 1234",
      note: "展示資料：希望本週成交",
      status: "published",
      created_at: demoNow(0),
      expires_at: demoNow(7),
    },
  ];
  demoWriteListings(seeded);
  return seeded;
}

function demoPublicListing(listing) {
  const winner = demoWinners[listing.employee_no];
  return {
    id: listing.id,
    price: listing.price,
    negotiable: listing.negotiable,
    contact: listing.contact,
    note: listing.note,
    created_at: listing.created_at,
    expires_at: listing.expires_at,
    name: winner.name,
    unit: winner.unit,
    country: winner.country,
  };
}

function demoListingStatusLabel(status) {
  return { published: "刊登中", sold: "已售出", closed: "已下架", expired: "已過期" }[status] || status;
}

function demoFindOwnedListing(listingId, employeeNo) {
  const listings = demoSeedListing();
  const id = Number.parseInt(String(listingId || ""), 10);
  const listing = listings.find((item) => item.id === id && item.employee_no === employeeNo);
  if (!listing) throw new Error("查無這筆公告，請確認員工編號是否正確。");
  return { listings, listing };
}

async function demoApi(path, options = {}) {
  const url = new URL(path, window.location.origin);
  const method = String(options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  if (url.pathname === "/api/listings" && method === "GET") {
    let listings = demoSeedListing().filter((listing) => listing.status === "published");
    const country = url.searchParams.get("country");
    const sort = url.searchParams.get("sort") || "newest";
    if (country) {
      listings = listings.filter((listing) => demoWinners[listing.employee_no].country === country);
    }
    if (sort === "price_asc") listings.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") listings.sort((a, b) => b.price - a.price);
    if (sort === "newest") listings.sort((a, b) => String(b.created_at).localeCompare(a.created_at));
    return {
      ok: true,
      listings: listings.map(demoPublicListing),
      countries: [...new Set(Object.values(demoWinners).map((winner) => winner.country))],
    };
  }

  if (url.pathname === "/api/winner" && method === "GET") {
    const employeeNo = String(url.searchParams.get("employee_no") || "").trim().toUpperCase();
    const winner = demoWinners[employeeNo];
    if (!winner) throw new Error("查無得獎資料，請確認員工編號是否正確。");
    const active = demoReadListings().find(
      (listing) => listing.employee_no === employeeNo && listing.status === "published"
    );
    return { ok: true, winner, has_active_listing: Boolean(active), active_listing_id: active?.id || null };
  }

  if (url.pathname === "/api/listings" && method === "POST") {
    const employeeNo = String(body.employee_no || "").trim().toUpperCase();
    const winner = demoWinners[employeeNo];
    if (!winner) throw new Error("查無得獎資料，請確認員工編號是否正確。");
    const listings = demoReadListings();
    if (listings.some((listing) => listing.employee_no === employeeNo && listing.status === "published")) {
      throw new Error("你目前已有刊登中的公告，請到「管理我的公告」修改或下架。");
    }
    const price = Number.parseInt(String(body.price || "").replace(/,/g, ""), 10);
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error("希望售價請輸入正整數。");
    const contact = String(body.contact || "").trim();
    if (!contact) throw new Error("請填寫買方可以聯絡你的方式。");
    const listing = {
      id: Math.max(0, ...listings.map((item) => item.id)) + 1,
      employee_no: employeeNo,
      price,
      negotiable: body.negotiable === "no" ? "no" : "yes",
      contact,
      note: String(body.note || "").trim(),
      status: "published",
      created_at: demoNow(0),
      expires_at: demoNow(7),
    };
    demoWriteListings([listing, ...listings]);
    return { ok: true, listing_id: listing.id, message: "公告已刊登。" };
  }

  if (url.pathname === "/api/my-listings" && method === "GET") {
    const employeeNo = String(url.searchParams.get("employee_no") || "").trim().toUpperCase();
    const winner = demoWinners[employeeNo];
    if (!winner) throw new Error("查無得獎資料，請確認員工編號是否正確。");
    const listings = demoSeedListing()
      .filter((listing) => listing.employee_no === employeeNo)
      .map((listing) => ({
        ...demoPublicListing(listing),
        employee_no: employeeNo,
        status: listing.status,
        status_label: demoListingStatusLabel(listing.status),
      }));
    return { ok: true, winner, listings };
  }

  const ownedAction = url.pathname.match(/^\/api\/listings\/(\d+)\/(update|sold|close|republish)$/);
  if (ownedAction && method === "POST") {
    const employeeNo = String(body.employee_no || "").trim().toUpperCase();
    const { listings, listing } = demoFindOwnedListing(ownedAction[1], employeeNo);
    const action = ownedAction[2];

    if (action === "update") {
      if (listing.status !== "published") throw new Error("這筆公告目前不是刊登中狀態，不能再修改。");
      const price = Number.parseInt(String(body.price || "").replace(/,/g, ""), 10);
      if (!Number.isSafeInteger(price) || price <= 0) throw new Error("希望售價請輸入正整數。");
      const contact = String(body.contact || "").trim();
      if (!contact) throw new Error("請填寫買方可以聯絡你的方式。");
      listing.price = price;
      listing.negotiable = body.negotiable === "no" ? "no" : "yes";
      listing.contact = contact;
      listing.note = String(body.note || "").trim();
      listing.updated_at = demoNow(0);
      demoWriteListings(listings);
      return { ok: true, message: "公告已更新。" };
    }

    if (action === "sold") {
      if (listing.status !== "published") throw new Error("這筆公告目前不是刊登中。");
      listing.status = "sold";
      listing.close_reason = "sold";
      listing.updated_at = demoNow(0);
      demoWriteListings(listings);
      return { ok: true, message: "已標記為售出，公告會從首頁移除。" };
    }

    if (action === "close") {
      if (listing.status !== "published") throw new Error("這筆公告目前不是刊登中。");
      listing.status = "closed";
      listing.close_reason = "employee_closed";
      listing.updated_at = demoNow(0);
      demoWriteListings(listings);
      return { ok: true, message: "公告已下架。" };
    }

    if (action === "republish") {
      if (!["sold", "closed", "expired"].includes(listing.status)) {
        throw new Error("只有已售出、已下架或已過期的公告可以重新刊登。");
      }
      if (listings.some((item) => item.employee_no === employeeNo && item.status === "published")) {
        throw new Error("你目前已有刊登中的公告，請到「管理我的公告」修改或下架。");
      }
      listing.status = "published";
      listing.close_reason = "";
      listing.updated_at = demoNow(0);
      listing.expires_at = demoNow(7);
      demoWriteListings(listings);
      return { ok: true, message: "公告已重新刊登。" };
    }
  }

  throw new Error("展示模式目前沒有這個操作。");
}

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({ ok: false, message: "系統回應格式不正確。" }));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || "系統暫時無法完成操作。");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (isLocalPreview()) return demoApi(path, options);
    throw error;
  }
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fillCountrySelect(select, countries = []) {
  if (!select) return;
  const current = select.value;
  const values = [...new Set([...fixedCountries, ...countries].filter(Boolean))];
  select.innerHTML = '<option value="">全部</option>';
  values.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    select.append(option);
  });
  select.value = values.includes(current) ? current : "";
}

function listingCard(listing) {
  const article = document.createElement("article");
  article.className = "listing-card";
  article.innerHTML = `
    <div class="listing-top">
      <h2 class="country-title"></h2>
      <span class="status-pill">刊登中</span>
    </div>
    <div class="price"></div>
    <dl class="meta-list">
      <div><dt>是否可議價</dt><dd data-field="negotiable"></dd></div>
      <div><dt>刊登人</dt><dd data-field="owner"></dd></div>
      <div><dt>聯絡方式</dt><dd data-field="contact"></dd></div>
      <div><dt>刊登日期</dt><dd data-field="created"></dd></div>
      <div><dt>到期日</dt><dd data-field="expires"></dd></div>
    </dl>
    <p class="note hidden"></p>
  `;
  $(".country-title", article).textContent = `${listing.country}旅遊獎勵`;
  $(".price", article).textContent = `NT$ ${formatMoney(listing.price)}`;
  $('[data-field="negotiable"]', article).textContent = negotiableText(listing.negotiable);
  $('[data-field="owner"]', article).textContent = `${listing.name}｜${listing.unit}`;
  $('[data-field="contact"]', article).textContent = listing.contact;
  $('[data-field="created"]', article).textContent = formatDate(listing.created_at);
  $('[data-field="expires"]', article).textContent = formatDate(listing.expires_at);
  if (listing.note) {
    $(".note", article).textContent = listing.note;
    $(".note", article).classList.remove("hidden");
  }
  return article;
}

async function loadHome() {
  const grid = $("#listingGrid");
  const status = $("#homeStatus");
  const country = $("#countryFilter");
  const sort = $("#sortFilter");
  const params = new URLSearchParams();
  if (country.value) params.set("country", country.value);
  if (sort.value) params.set("sort", sort.value);

  setMessage(status, "讀取公告中...");
  grid.innerHTML = "";

  try {
    const data = await api(`/api/listings?${params.toString()}`);
    fillCountrySelect(country, data.countries);
    grid.innerHTML = "";
    if (!data.listings.length) {
      grid.innerHTML = '<div class="empty-state">目前沒有刊登中公告</div>';
      setMessage(status, "");
      return;
    }
    data.listings.forEach((listing) => grid.append(listingCard(listing)));
    setMessage(status, `目前刊登中公告 ${data.listings.length} 筆`);
  } catch (error) {
    setMessage(status, error.message, "error");
  }
}

function initHome() {
  $("#countryFilter")?.addEventListener("change", loadHome);
  $("#sortFilter")?.addEventListener("change", loadHome);
  loadHome();
}

function renderWinner(winner) {
  const summary = $("#winnerSummary");
  summary.innerHTML = "";
  [
    ["姓名", winner.name],
    ["單位", winner.unit],
    ["國家", winner.country],
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<strong></strong><span></span>`;
    $("strong", item).textContent = label;
    $("span", item).textContent = value;
    summary.append(item);
  });
}

function initPost() {
  let employeeNo = "";
  $("#lookupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#lookupMessage");
    const form = event.currentTarget;
    employeeNo = form.employee_no.value.trim().toUpperCase();
    $("#winnerPanel").classList.add("hidden");
    setMessage(message, "查詢中...");

    try {
      const data = await api(`/api/winner?employee_no=${encodeURIComponent(employeeNo)}`);
      if (data.has_active_listing) {
        setMessage(message, "你目前已有刊登中的公告，請到「管理我的公告」修改或下架。", "warn");
        return;
      }
      renderWinner(data.winner);
      $("#winnerPanel").classList.remove("hidden");
      setMessage(message, "查詢成功，請填寫公告內容。", "success");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });

  $("#postForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#lookupMessage");
    const data = { ...formData(event.currentTarget), employee_no: employeeNo };
    setMessage(message, "送出中...");

    try {
      const result = await api("/api/listings", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setMessage(message, result.message, "success");
      window.location.href = "/";
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function listingForm(listing, employeeNo) {
  const form = document.createElement("form");
  form.className = "form-grid";
  form.innerHTML = `
    <label>
      <span>希望售價</span>
      <input name="price" inputmode="numeric" required />
    </label>
    <label>
      <span>是否可議價</span>
      <select name="negotiable" required>
        <option value="yes">可議價</option>
        <option value="no">不可議價</option>
      </select>
    </label>
    <label class="span-2">
      <span>聯絡方式</span>
      <input name="contact" maxlength="80" required />
    </label>
    <label class="span-2">
      <span>備註</span>
      <textarea name="note" rows="3" maxlength="500"></textarea>
    </label>
    <button class="button primary span-2" type="submit">修改公告</button>
  `;
  form.price.value = listing.price;
  form.negotiable.value = listing.negotiable;
  form.contact.value = listing.contact || "";
  form.note.value = listing.note || "";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api(`/api/listings/${listing.id}/update`, {
        method: "POST",
        body: JSON.stringify({ ...formData(form), employee_no: employeeNo }),
      });
      alert(result.message);
      loadMyListings(employeeNo);
    } catch (error) {
      alert(error.message);
    }
  });
  return form;
}

function myCard(listing, employeeNo) {
  const card = document.createElement("article");
  card.className = "my-card";
  card.innerHTML = `
    <div class="listing-top">
      <h2 class="country-title"></h2>
      <span class="status-pill"></span>
    </div>
    <div class="price"></div>
    <dl class="meta-list">
      <div><dt>是否可議價</dt><dd>${negotiableText(listing.negotiable)}</dd></div>
      <div><dt>聯絡方式</dt><dd></dd></div>
      <div><dt>建立日期</dt><dd>${formatDate(listing.created_at)}</dd></div>
      <div><dt>到期日</dt><dd>${formatDate(listing.expires_at)}</dd></div>
    </dl>
    <p class="note hidden"></p>
    <div class="card-actions"></div>
  `;
  $(".country-title", card).textContent = `${listing.country}旅遊獎勵`;
  $(".status-pill", card).textContent = listing.status_label;
  $(".status-pill", card).classList.add(listing.status);
  $(".price", card).textContent = `NT$ ${formatMoney(listing.price)}`;
  $("dd", $(".meta-list div:nth-child(2)", card)).textContent = listing.contact;
  if (listing.note) {
    $(".note", card).textContent = listing.note;
    $(".note", card).classList.remove("hidden");
  }

  if (listing.status === "published") {
    card.append(listingForm(listing, employeeNo));
    const actions = $(".card-actions", card);
    const sold = document.createElement("button");
    sold.className = "button secondary";
    sold.type = "button";
    sold.textContent = "已售出";
    sold.addEventListener("click", () => myAction(listing.id, employeeNo, "sold"));
    const close = document.createElement("button");
    close.className = "button danger";
    close.type = "button";
    close.textContent = "不賣了，下架";
    close.addEventListener("click", () => myAction(listing.id, employeeNo, "close"));
    actions.append(sold, close);
  } else {
    const republish = document.createElement("button");
    republish.className = "button primary";
    republish.type = "button";
    republish.textContent = "重新刊登";
    republish.addEventListener("click", () => myAction(listing.id, employeeNo, "republish"));
    $(".card-actions", card).append(republish);
  }

  return card;
}

async function myAction(id, employeeNo, action) {
  const paths = {
    sold: `/api/listings/${id}/sold`,
    close: `/api/listings/${id}/close`,
    republish: `/api/listings/${id}/republish`,
  };
  const labels = {
    sold: "確定要標記為已售出嗎？",
    close: "確定要下架這筆公告嗎？",
    republish: "確定要重新刊登這筆公告嗎？",
  };
  if (!confirm(labels[action])) return;
  try {
    const result = await api(paths[action], {
      method: "POST",
      body: JSON.stringify({ employee_no: employeeNo }),
    });
    alert(result.message);
    loadMyListings(employeeNo);
  } catch (error) {
    alert(error.message);
  }
}

async function loadMyListings(employeeNo) {
  const list = $("#myListings");
  const message = $("#myMessage");
  list.innerHTML = "";
  setMessage(message, "查詢中...");
  try {
    const data = await api(`/api/my-listings?employee_no=${encodeURIComponent(employeeNo)}`);
    if (!data.listings.length) {
      setMessage(message, "目前沒有公告紀錄。", "warn");
      return;
    }
    setMessage(message, `${data.winner.name}｜${data.winner.unit}｜${data.winner.country}`);
    data.listings.forEach((listing) => list.append(myCard(listing, employeeNo)));
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

function initMy() {
  $("#myLookupForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadMyListings(event.currentTarget.employee_no.value.trim().toUpperCase());
  });
}

async function requireAdminPage() {
  const data = await api("/api/auth/me");
  if (!data.authenticated) {
    window.location.href = "/admin/login.html";
    return false;
  }
  return true;
}

function initLogin() {
  $("#adminLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#loginMessage");
    setMessage(message, "登入中...");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      });
      window.location.href = "/admin/index.html";
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function bindLogout() {
  $("#logoutButton")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    window.location.href = "/admin/login.html";
  });
}

function countMap(counts) {
  return Object.fromEntries((counts || []).map((row) => [row.status, row.total]));
}

function renderStats(data) {
  const counts = countMap(data.counts);
  const stats = [
    ["得獎名單總數", data.winners_total || 0],
    ["刊登中公告數", counts.published || 0],
    ["已售出公告數", counts.sold || 0],
    ["已下架公告數", counts.closed || 0],
    ["已過期公告數", counts.expired || 0],
  ];
  $("#adminStats").innerHTML = stats
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function adminRow(listing) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><span class="status-pill ${listing.status}">${listing.status_label}</span></td>
    <td><span class="cell-main"></span><span class="cell-sub"></span></td>
    <td><span class="cell-main"></span><span class="cell-sub"></span></td>
    <td></td>
    <td></td>
    <td></td>
    <td><div class="table-actions"></div></td>
  `;
  const cells = $$("td", tr);
  $(".cell-main", cells[1]).textContent = listing.name;
  $(".cell-sub", cells[1]).textContent = `${listing.employee_no}｜${listing.unit}`;
  $(".cell-main", cells[2]).textContent = listing.country;
  $(".cell-sub", cells[2]).textContent = formatDate(listing.expires_at);
  cells[3].textContent = `NT$ ${formatMoney(listing.price)}｜${negotiableText(listing.negotiable)}`;
  cells[4].textContent = listing.contact;
  cells[5].textContent = formatDate(listing.created_at);

  const actions = $(".table-actions", tr);
  const edit = document.createElement("button");
  edit.className = "button secondary compact";
  edit.type = "button";
  edit.textContent = "修改";
  edit.addEventListener("click", () => adminEdit(listing));
  actions.append(edit);

  if (listing.status === "published") {
    const close = document.createElement("button");
    close.className = "button danger compact";
    close.type = "button";
    close.textContent = "下架";
    close.addEventListener("click", () => adminClose(listing.id));
    actions.append(close);
  } else {
    const restore = document.createElement("button");
    restore.className = "button primary compact";
    restore.type = "button";
    restore.textContent = "恢復";
    restore.addEventListener("click", () => adminRestore(listing.id));
    actions.append(restore);
  }
  return tr;
}

async function loadAdmin() {
  const params = new URLSearchParams();
  const status = $("#adminStatusFilter").value;
  const country = $("#adminCountryFilter").value;
  const keyword = $("#adminKeywordFilter").value.trim();
  if (status && status !== "all") params.set("status", status);
  if (country) params.set("country", country);
  if (keyword) params.set("q", keyword);

  const message = $("#adminMessage");
  setMessage(message, "讀取後台資料中...");
  try {
    const data = await api(`/api/admin/listings?${params.toString()}`);
    renderStats(data);
    fillCountrySelect($("#adminCountryFilter"), data.countries);
    const rows = $("#adminListingRows");
    rows.innerHTML = "";
    data.listings.forEach((listing) => rows.append(adminRow(listing)));
    if (!data.listings.length) {
      rows.innerHTML = '<tr><td colspan="7">目前沒有符合條件的公告。</td></tr>';
    }
    setMessage(message, `共 ${data.listings.length} 筆公告`);
    loadAuditLogs();
  } catch (error) {
    setMessage(message, error.message, "error");
    if (error.status === 401) window.location.href = "/admin/login.html";
  }
}

async function adminEdit(listing) {
  const price = prompt("希望售價", listing.price);
  if (!price) return;
  const negotiable = confirm("按確定代表可議價，按取消代表不可議價。") ? "yes" : "no";
  const contact = prompt("聯絡方式", listing.contact || "");
  if (!contact) return;
  const note = prompt("備註", listing.note || "") || "";
  try {
    const result = await api(`/api/admin/listings/${listing.id}/update`, {
      method: "POST",
      body: JSON.stringify({ price, negotiable, contact, note }),
    });
    alert(result.message);
    loadAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function adminClose(id) {
  if (!confirm("確定要強制下架這筆公告嗎？")) return;
  try {
    const result = await api(`/api/admin/listings/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ close_reason: "admin_closed" }),
    });
    alert(result.message);
    loadAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function adminRestore(id) {
  if (!confirm("確定要恢復這筆公告嗎？")) return;
  try {
    const result = await api(`/api/admin/listings/${id}/restore`, {
      method: "POST",
      body: "{}",
    });
    alert(result.message);
    loadAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function loadAuditLogs() {
  const box = $("#auditLogs");
  if (!box) return;
  try {
    const data = await api("/api/admin/audit-logs?limit=50");
    if (!data.logs.length) {
      box.innerHTML = '<div class="empty-state">目前沒有操作紀錄。</div>';
      return;
    }
    box.innerHTML = data.logs
      .map(
        (log) => `
          <div class="audit-item">
            <strong>${log.action}</strong>
            <span>${log.employee_no || "-"}｜公告 ${log.listing_id || "-"}｜${formatDate(log.created_at)}｜${log.ip_address || "-"}</span>
          </div>`
      )
      .join("");
  } catch {
    box.innerHTML = '<div class="empty-state">操作紀錄尚無法讀取。</div>';
  }
}

async function initAdminDashboard() {
  if (!(await requireAdminPage())) return;
  bindLogout();
  ["adminStatusFilter", "adminCountryFilter"].forEach((id) => {
    $(`#${id}`)?.addEventListener("change", loadAdmin);
  });
  $("#adminKeywordFilter")?.addEventListener("input", () => {
    clearTimeout(window.__adminSearchTimer);
    window.__adminSearchTimer = setTimeout(loadAdmin, 250);
  });
  $("#expireOldButton")?.addEventListener("click", async () => {
    const result = await api("/api/admin/listings", {
      method: "POST",
      body: JSON.stringify({ action: "expire_old" }),
    });
    alert(result.message);
    loadAdmin();
  });
  $("#settingsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      });
      alert(result.message);
    } catch (error) {
      alert(error.message);
    }
  });
  const settings = await api("/api/admin/settings").catch(() => null);
  if (settings) $('[name="listing_expire_days"]', $("#settingsForm")).value = settings.listing_expire_days;
  loadAdmin();
}

async function initSetup() {
  if (!(await requireAdminPage())) return;
  bindLogout();
  $("#setupButton")?.addEventListener("click", async () => {
    const message = $("#setupMessage");
    setMessage(message, "初始化中...");
    try {
      const result = await api("/api/admin/setup", { method: "POST", body: "{}" });
      setMessage(message, result.message, "success");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function downloadSampleCsv() {
  const csv = "員工編號,姓名,單位,國家\nA001,王小明,業務一處,日本\nA002,李小華,北區單位,韓國\nA003,陳大明,南區單位,泰國\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "winners-sample.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadWinnerStats() {
  const stats = $("#winnerStats");
  try {
    const data = await api("/api/admin/import-winners");
    setMessage(stats, `目前得獎名單 ${data.total || 0} 筆`);
  } catch (error) {
    setMessage(stats, error.message, "error");
  }
}

async function initWinners() {
  if (!(await requireAdminPage())) return;
  bindLogout();
  $("#sampleCsvButton")?.addEventListener("click", downloadSampleCsv);
  $("#winnerImportForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#winnerImportMessage");
    setMessage(message, "匯入中...");
    try {
      const result = await api("/api/admin/import-winners", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      });
      setMessage(message, result.message, result.error_count ? "warn" : "success");
      if (result.errors?.length) {
        const list = document.createElement("ul");
        list.className = "error-list";
        result.errors.slice(0, 20).forEach((item) => {
          const li = document.createElement("li");
          li.textContent = `第 ${item.row} 列：${item.message}`;
          list.append(li);
        });
        message.append(list);
      }
      loadWinnerStats();
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  loadWinnerStats();
}

const initializers = {
  home: initHome,
  post: initPost,
  my: initMy,
  "admin-login": initLogin,
  "admin-dashboard": initAdminDashboard,
  "admin-setup": initSetup,
  "admin-winners": initWinners,
};

initializers[page]?.();
