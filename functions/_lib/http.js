export class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    ""
  )
    .split(",")[0]
    .trim();
}

export function userAgent(request) {
  return String(request.headers.get("user-agent") || "").slice(0, 500);
}

export function pageRedirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: { location },
  });
}

export async function readJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "BAD_JSON", "請確認送出的資料格式是否正確。");
  }
}

export function requireDb(env) {
  if (!env.DB) {
    throw new AppError(
      500,
      "DB_NOT_BOUND",
      "尚未綁定 D1 資料庫。請在 Cloudflare Pages 專案中新增 D1 binding，名稱必須是 DB。"
    );
  }
}

export function normalizeEmployeeNo(value) {
  return String(value || "").trim().toUpperCase();
}

export function text(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDaysIso(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString();
}

export function parsePrice(value) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!/^\d+$/.test(raw)) {
    throw new AppError(400, "INVALID_PRICE", "希望售價請輸入正整數。");
  }

  const price = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(price) || price <= 0 || price > 99999999) {
    throw new AppError(400, "INVALID_PRICE", "希望售價超出可接受範圍。");
  }

  return price;
}

export function parseNegotiable(value) {
  if (value === "yes" || value === true || value === 1 || value === "1" || value === "true") {
    return "yes";
  }
  if (value === "no" || value === false || value === 0 || value === "0" || value === "false") {
    return "no";
  }
  throw new AppError(400, "INVALID_NEGOTIABLE", "請選擇是否可議價。");
}

export function validateEmployeeNo(employeeNo) {
  if (!employeeNo || employeeNo.length > 40) {
    throw new AppError(400, "INVALID_EMPLOYEE_NO", "請輸入正確的員工編號。");
  }
}

export function validateListingInput(data) {
  const price = parsePrice(data.price);
  const contact = text(data.contact, 80);
  const note = text(data.note, 500);
  const negotiable = parseNegotiable(data.negotiable);

  if (!contact) {
    throw new AppError(400, "MISSING_CONTACT", "請填寫買方可以聯絡你的方式。");
  }

  return {
    price,
    contact,
    note,
    negotiable,
  };
}

export function isMissingTableError(error) {
  return String(error && error.message ? error.message : error).includes("no such table");
}

export function handleError(error) {
  if (error instanceof AppError) {
    return json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      },
      { status: error.status }
    );
  }

  if (isMissingTableError(error)) {
    return json(
      {
        ok: false,
        code: "SETUP_REQUIRED",
        message: "資料庫尚未初始化。請管理員先登入後台並執行初始化資料庫。",
      },
      { status: 503 }
    );
  }

  console.error(error);
  return json(
    {
      ok: false,
      code: "SERVER_ERROR",
      message: "系統暫時無法完成操作，請稍後再試。",
    },
    { status: 500 }
  );
}
