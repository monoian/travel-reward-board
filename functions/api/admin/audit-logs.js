import { handleError, json, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "100", 10), 1), 300);
    const logs = await env.DB.prepare(
      `SELECT id, employee_no, action, listing_id, ip_address, user_agent, created_at
         FROM audit_logs
        ORDER BY created_at DESC
        LIMIT ?`
    )
      .bind(limit)
      .all();

    return json({
      ok: true,
      logs: logs.results || [],
    });
  } catch (error) {
    return handleError(error);
  }
}

