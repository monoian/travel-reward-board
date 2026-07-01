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
import { assertPublishedListing, audit, expireOldListings } from "../../../_lib/db.js";

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

    assertPublishedListing(listing);
    await env.DB.prepare(
      `UPDATE listings
          SET status = 'sold', close_reason = 'sold', updated_at = ?
        WHERE id = ?`
    )
      .bind(nowIso(), id)
      .run();

    await audit(env, request, employeeNo, "mark_sold", id);
    return json({ ok: true, message: "已標記為售出，公告會從首頁移除。" });
  } catch (error) {
    return handleError(error);
  }
}
