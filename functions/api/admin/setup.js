import { audit, normalizeExpireDays } from "../../_lib/db.js";
import { handleError, json, nowIso, requireDb } from "../../_lib/http.js";
import { SETUP_SQL } from "../../_lib/schema.js";
import { requireAdmin } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);

    await env.DB.exec(SETUP_SQL);
    const days = normalizeExpireDays(env.LISTING_EXPIRE_DAYS || "7");
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

    await audit(env, request, "admin", "admin_setup", null);

    return json({
      ok: true,
      message: "資料庫初始化完成。",
      tables: ["winners", "listings", "audit_logs", "settings"],
    });
  } catch (error) {
    return handleError(error);
  }
}

