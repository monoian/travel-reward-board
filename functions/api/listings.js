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
} from "../_lib/http.js";
import {
  audit,
  expireOldListings,
  getListingExpireDays,
  getWinner,
  listingExpiryFromNow,
} from "../_lib/db.js";

const SORTS = {
  newest: "l.created_at DESC",
  price_asc: "l.price ASC, l.created_at DESC",
  price_desc: "l.price DESC, l.created_at DESC",
};

export async function onRequestGet({ request, env }) {
  try {
    requireDb(env);
    await expireOldListings(env);

    const url = new URL(request.url);
    const country = String(url.searchParams.get("country") || "").trim();
    const sort = SORTS[url.searchParams.get("sort")] || SORTS.newest;
    const bindings = [nowIso()];
    let countryClause = "";

    if (country) {
      countryClause = "AND w.country = ?";
      bindings.push(country);
    }

    const listings = await env.DB.prepare(
      `SELECT l.id, l.price, l.negotiable, l.contact, l.note, l.created_at, l.expires_at,
              w.name, w.unit, w.country
         FROM listings l
         JOIN winners w ON w.id = l.winner_id
        WHERE l.status = 'published'
          AND l.expires_at > ?
          ${countryClause}
        ORDER BY ${sort}`
    )
      .bind(...bindings)
      .all();

    const countries = await env.DB.prepare(
      `SELECT DISTINCT country
         FROM winners
        WHERE country IS NOT NULL AND country != ''
        ORDER BY country`
    ).all();

    return json({
      ok: true,
      listings: listings.results || [],
      countries: (countries.results || []).map((row) => row.country),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    requireDb(env);
    const data = await readJson(request);
    const employeeNo = normalizeEmployeeNo(data.employee_no);
    validateEmployeeNo(employeeNo);

    const input = validateListingInput(data);
    await expireOldListings(env);

    const winner = await getWinner(env, employeeNo);
    if (!winner) {
      throw new AppError(404, "WINNER_NOT_FOUND", "查無得獎資料，請確認員工編號是否正確。");
    }

    const active = await env.DB.prepare(
      `SELECT id
         FROM listings
        WHERE winner_id = ?
          AND status = 'published'
        LIMIT 1`
    )
      .bind(winner.id)
      .first();

    if (active) {
      throw new AppError(
        409,
        "ACTIVE_LISTING_EXISTS",
        "你目前已有刊登中的公告，請到「管理我的公告」修改或下架。"
      );
    }

    const now = nowIso();
    const expireDays = await getListingExpireDays(env);
    const expiresAt = listingExpiryFromNow(expireDays);
    const result = await env.DB.prepare(
      `INSERT INTO listings (
         winner_id, price, negotiable, contact, note, status, created_at, updated_at, expires_at
       )
       VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?)`
    )
      .bind(winner.id, input.price, input.negotiable, input.contact, input.note, now, now, expiresAt)
      .run();

    const listingId = result.meta && result.meta.last_row_id ? result.meta.last_row_id : null;
    await audit(env, request, employeeNo, "create_listing", listingId);

    return json({
      ok: true,
      listing_id: listingId,
      message: "公告已刊登。",
    });
  } catch (error) {
    if (String(error && error.message).includes("UNIQUE constraint failed")) {
      return handleError(
        new AppError(
          409,
          "ACTIVE_LISTING_EXISTS",
          "你目前已有刊登中的公告，請到「管理我的公告」修改或下架。"
        )
      );
    }
    return handleError(error);
  }
}

