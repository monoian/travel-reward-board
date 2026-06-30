import { audit, getListingExpireDays, normalizeExpireDays } from "../../_lib/db.js";
import { handleError, json, nowIso, readJson, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);
    const listingExpireDays = await getListingExpireDays(env);
    return json({
      ok: true,
      listing_expire_days: listingExpireDays,
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
    const days = normalizeExpireDays(data.listing_expire_days);
    const now = nowIso();

    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('LISTING_EXPIRE_DAYS', ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    )
      .bind(String(days), now)
      .run();

    await audit(env, request, "admin", "update_settings", null);

    return json({
      ok: true,
      listing_expire_days: days,
      message: `新公告有效天數已改為 ${days} 天。`,
    });
  } catch (error) {
    return handleError(error);
  }
}

