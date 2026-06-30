import {
  AppError,
  handleError,
  json,
  nowIso,
  readJson,
  requireDb,
  validateListingInput,
} from "../../../../_lib/http.js";
import { audit, expireOldListings } from "../../../../_lib/db.js";
import { requireAdmin } from "../../../../_lib/session.js";

function parseId(value) {
  const id = Number.parseInt(String(value || ""), 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, "INVALID_LISTING_ID", "找不到要處理的公告。");
  }
  return id;
}

export async function onRequestPost({ request, env, params }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);
    const id = parseId(params.id);
    const data = await readJson(request);
    const input = validateListingInput(data);
    await expireOldListings(env);

    const listing = await env.DB.prepare(
      `SELECT l.id, w.employee_no
         FROM listings l
         JOIN winners w ON w.id = l.winner_id
        WHERE l.id = ?`
    )
      .bind(id)
      .first();

    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "找不到這筆公告。");
    }

    await env.DB.prepare(
      `UPDATE listings
          SET price = ?, negotiable = ?, contact = ?, note = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(input.price, input.negotiable, input.contact, input.note, nowIso(), id)
      .run();

    await audit(env, request, listing.employee_no, "admin_update", id);
    return json({ ok: true, message: "公告已更新。" });
  } catch (error) {
    return handleError(error);
  }
}

