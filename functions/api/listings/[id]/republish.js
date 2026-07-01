import {
  AppError,
  handleError,
  json,
  normalizeEmployeeNo,
  nowIso,
  readJson,
  requireDb,
  requireEmployeePassword,
  validateEmployeeNo,
} from "../../../_lib/http.js";
import { audit, expireOldListings, getListingExpireDays, listingExpiryFromNow } from "../../../_lib/db.js";

function parseId(value) {
  const id = Number.parseInt(String(value || ""), 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, "INVALID_LISTING_ID", "找不到要處理的公告。");
  }
  return id;
}

export async function onRequestPost({ request, env, params }) {
  try {
    requireDb(env);
    const id = parseId(params.id);
    const data = await readJson(request);
    const employeeNo = normalizeEmployeeNo(data.employee_no);
    validateEmployeeNo(employeeNo);
    requireEmployeePassword(env, data.employee_password);
    await expireOldListings(env);

    const listing = await env.DB.prepare(
      `SELECT l.*
         FROM listings l
         JOIN winners w ON w.id = l.winner_id
        WHERE l.id = ?
          AND w.employee_no = ?`
    )
      .bind(id, employeeNo)
      .first();

    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "查無這筆公告，請確認員工編號是否正確。");
    }

    if (!["sold", "closed", "expired"].includes(listing.status)) {
      throw new AppError(409, "NOT_REPUBLISHABLE", "只有已售出、已下架或已過期的公告可以重新刊登。");
    }

    const active = await env.DB.prepare(
      `SELECT id
         FROM listings
        WHERE winner_id = ?
          AND status = 'published'
        LIMIT 1`
    )
      .bind(listing.winner_id)
      .first();

    if (active) {
      throw new AppError(
        409,
        "ACTIVE_LISTING_EXISTS",
        "你目前已有刊登中的公告，請到「管理我的公告」修改或下架。"
      );
    }

    const days = await getListingExpireDays(env);
    await env.DB.prepare(
      `UPDATE listings
          SET status = 'published', close_reason = NULL, expires_at = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(listingExpiryFromNow(days), nowIso(), id)
      .run();

    await audit(env, request, employeeNo, "republish_listing", id);
    return json({ ok: true, message: "公告已重新刊登。" });
  } catch (error) {
    return handleError(error);
  }
}
