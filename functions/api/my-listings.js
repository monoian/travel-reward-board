import {
  AppError,
  handleError,
  json,
  normalizeEmployeeNo,
  requireDb,
  validateEmployeeNo,
} from "../_lib/http.js";
import { STATUS_LABELS, expireOldListings, getWinner } from "../_lib/db.js";

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

    const response = await env.DB.prepare(
      `SELECT l.id, l.price, l.negotiable, l.contact, l.note, l.status,
              l.close_reason, l.created_at, l.updated_at, l.expires_at,
              w.employee_no, w.name, w.unit, w.country
         FROM listings l
         JOIN winners w ON w.id = l.winner_id
        WHERE w.employee_no = ?
        ORDER BY
          CASE WHEN l.status = 'published' THEN 0 ELSE 1 END,
          l.created_at DESC`
    )
      .bind(employeeNo)
      .all();

    const listings = (response.results || []).map((listing) => ({
      ...listing,
      status_label: STATUS_LABELS[listing.status] || listing.status,
    }));

    return json({
      ok: true,
      winner: {
        employee_no: winner.employee_no,
        name: winner.name,
        unit: winner.unit,
        country: winner.country,
      },
      listings,
    });
  } catch (error) {
    return handleError(error);
  }
}

