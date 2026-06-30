import { audit } from "../../_lib/db.js";
import { parseWinnersCsv } from "../../_lib/csv.js";
import { AppError, handleError, json, nowIso, readJson, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    requireDb(env);

    const stats = await env.DB.prepare(
      `SELECT COUNT(*) AS total, MAX(updated_at) AS last_updated_at
         FROM winners`
    ).first();

    return json({
      ok: true,
      total: stats ? stats.total : 0,
      last_updated_at: stats ? stats.last_updated_at : null,
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
    const { winners, errors } = parseWinnersCsv(data.csv);

    if (!winners.length) {
      throw new AppError(400, "NO_VALID_ROWS", "沒有可匯入的資料列。", { errors });
    }

    const now = nowIso();
    const statements = winners.map((winner) =>
      env.DB.prepare(
        `INSERT INTO winners (employee_no, name, unit, country, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(employee_no) DO UPDATE SET
           name = excluded.name,
           unit = excluded.unit,
           country = excluded.country,
           updated_at = excluded.updated_at`
      ).bind(winner.employeeNo, winner.name, winner.unit, winner.country, now)
    );

    await env.DB.batch(statements);
    await audit(env, request, "admin", "import_winners", null);

    return json({
      ok: true,
      imported: winners.length,
      error_count: errors.length,
      errors,
      message: `成功匯入 ${winners.length} 筆，錯誤 ${errors.length} 筆。`,
    });
  } catch (error) {
    return handleError(error);
  }
}
