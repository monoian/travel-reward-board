import {
  AppError,
  handleError,
  json,
  normalizeEmployeeNo,
  nowIso,
  readJson,
  requireDb,
  validateEmployeeNo,
  validateListingInput,
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
    const input = validateListingInput(data);
    await env.DB.prepare(
      `UPDATE listings
          SET price = ?, negotiable = ?, contact = ?, note = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(input.price, input.negotiable, input.contact, input.note, nowIso(), id)
      .run();

    await audit(env, request, employeeNo, "update_listing", id);
    return json({ ok: true, message: "公告已更新。" });
  } catch (error) {
    return handleError(error);
  }
}

