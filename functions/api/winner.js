import {
  AppError,
  handleError,
  json,
  normalizeEmployeeNo,
  requireDb,
  validateEmployeeNo,
} from "../_lib/http.js";
import { expireOldListings, getWinner } from "../_lib/db.js";

export async function onRequestGet({ request, env }) {
  try {
    requireDb(env);
    const url = new URL(request.url);
    const employeeNo = normalizeEmployeeNo(url.searchParams.get("employee_no"));
    validateEmployeeNo(employeeNo);
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

    return json({
      ok: true,
      winner: {
        employee_no: winner.employee_no,
        name: winner.name,
        unit: winner.unit,
        country: winner.country,
      },
      has_active_listing: Boolean(active),
      active_listing_id: active ? active.id : null,
    });
  } catch (error) {
    return handleError(error);
  }
}

