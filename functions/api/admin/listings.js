import { handleError, json, readJson, requireDb } from "../../_lib/http.js";
import { STATUS_LABELS, audit, expireOldListings } from "../../_lib/db.js";
import { requireAdmin } from "../../_lib/session.js";

const ALLOWED_STATUS = new Set(["published", "sold", "closed", "expired"]);

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);
    await expireOldListings(env);

    const url = new URL(request.url);
    const status = String(url.searchParams.get("status") || "all");
    const country = String(url.searchParams.get("country") || "").trim();
    const keyword = String(url.searchParams.get("q") || "").trim();

    const clauses = [];
    const bindings = [];

    if (ALLOWED_STATUS.has(status)) {
      clauses.push("l.status = ?");
      bindings.push(status);
    }

    if (country) {
      clauses.push("w.country = ?");
      bindings.push(country);
    }

    if (keyword) {
      clauses.push("(w.employee_no LIKE ? OR w.name LIKE ? OR w.unit LIKE ?)");
      const like = `%${keyword}%`;
      bindings.push(like, like, like);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const listings = await env.DB.prepare(
      `SELECT l.id, l.price, l.negotiable, l.contact, l.note, l.status, l.close_reason,
              l.created_at, l.updated_at, l.expires_at,
              w.employee_no, w.name, w.unit, w.country
         FROM listings l
         JOIN winners w ON w.id = l.winner_id
        ${where}
        ORDER BY l.created_at DESC
        LIMIT 500`
    )
      .bind(...bindings)
      .all();

    const counts = await env.DB.prepare(
      `SELECT status, COUNT(*) AS total
         FROM listings
        GROUP BY status`
    ).all();

    const winnerStats = await env.DB.prepare("SELECT COUNT(*) AS total FROM winners").first();

    const countries = await env.DB.prepare(
      `SELECT DISTINCT country
         FROM winners
        WHERE country IS NOT NULL AND country != ''
        ORDER BY country`
    ).all();

    return json({
      ok: true,
      listings: (listings.results || []).map((listing) => ({
        ...listing,
        status_label: STATUS_LABELS[listing.status] || listing.status,
      })),
      counts: counts.results || [],
      winners_total: winnerStats ? winnerStats.total : 0,
      countries: (countries.results || []).map((row) => row.country),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);
    const data = await readJson(request);
    if (data.action === "expire_old") {
      await expireOldListings(env);
      await audit(env, request, "admin", "expire_old_listings", null);
      return json({ ok: true, message: "已檢查並更新過期公告。" });
    }
    return json({ ok: false, message: "未知的管理操作。" }, { status: 400 });
  } catch (error) {
    return handleError(error);
  }
}

