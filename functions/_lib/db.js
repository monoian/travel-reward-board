import { AppError, addDaysIso, clientIp, isMissingTableError, nowIso, requireDb, userAgent } from "./http.js";

export const STATUS_LABELS = {
  published: "刊登中",
  sold: "已售出",
  closed: "已下架",
  expired: "已過期",
};

export function normalizeExpireDays(value) {
  const days = Number.parseInt(String(value || "7"), 10);
  if (!Number.isFinite(days)) return 7;
  return Math.min(Math.max(days, 1), 60);
}

export async function getListingExpireDays(env) {
  requireDb(env);
  let value = env.LISTING_EXPIRE_DAYS || "7";

  try {
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key IN ('LISTING_EXPIRE_DAYS', 'listing_expire_days') ORDER BY key = 'LISTING_EXPIRE_DAYS' DESC LIMIT 1"
    )
      .first();
    if (row && row.value) value = row.value;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  return normalizeExpireDays(value);
}

export async function expireOldListings(env) {
  requireDb(env);
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE listings
       SET status = 'expired', close_reason = COALESCE(close_reason, 'expired'), updated_at = ?
     WHERE status = 'published'
       AND expires_at <= ?`
  )
    .bind(now, now)
    .run();
}

export function listingExpiryFromNow(days) {
  return addDaysIso(new Date(), days);
}

export async function audit(env, request, employeeNo, action, listingId = null) {
  requireDb(env);
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (employee_no, action, listing_id, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(employeeNo || "", action, listingId, clientIp(request), userAgent(request), nowIso())
      .run();
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }
}

export async function getWinner(env, employeeNo) {
  requireDb(env);
  return env.DB.prepare(
    `SELECT id, employee_no, name, unit, country
       FROM winners
      WHERE employee_no = ?`
  )
    .bind(employeeNo)
    .first();
}

export function assertPublishedListing(listing) {
  if (!listing || listing.status !== "published") {
    throw new AppError(409, "NOT_PUBLISHED", "這筆公告目前不是刊登中狀態，不能再修改。");
  }
}
