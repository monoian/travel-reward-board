import { AppError, handleError, json, nowIso, requireDb } from "../../../../_lib/http.js";
import { audit, expireOldListings, getListingExpireDays, listingExpiryFromNow } from "../../../../_lib/db.js";
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
    await expireOldListings(env);

    const listing = await env.DB.prepare(
      `SELECT l.id, l.winner_id, l.status, w.employee_no
         FROM listings l
         JOIN winners w ON w.id = l.winner_id
        WHERE l.id = ?`
    )
      .bind(id)
      .first();

    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "找不到這筆公告。");
    }

    if (listing.status === "published") {
      throw new AppError(409, "ALREADY_PUBLISHED", "這筆公告已經是刊登中。");
    }

    const active = await env.DB.prepare(
      `SELECT id FROM listings WHERE winner_id = ? AND status = 'published' LIMIT 1`
    )
      .bind(listing.winner_id)
      .first();

    if (active) {
      throw new AppError(409, "ACTIVE_LISTING_EXISTS", "這位得獎人目前已有刊登中的公告。");
    }

    const days = await getListingExpireDays(env);
    await env.DB.prepare(
      `UPDATE listings
          SET status = 'published', close_reason = NULL, expires_at = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(listingExpiryFromNow(days), nowIso(), id)
      .run();

    await audit(env, request, listing.employee_no, "admin_restore", id);
    return json({ ok: true, message: "公告已恢復刊登。" });
  } catch (error) {
    return handleError(error);
  }
}

