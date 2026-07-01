import {
  AppError,
  handleError,
  json,
  normalizeEmployeeNo,
  readJson,
  requireDb,
  requireEmployeePassword,
  validateEmployeeNo,
} from "../_lib/http.js";
import { expireOldListings, getWinner } from "../_lib/db.js";

async function lookupWinner(request, env, data) {
  requireDb(env);
  const employeeNo = normalizeEmployeeNo(data.employee_no);
  validateEmployeeNo(employeeNo);
  requireEmployeePassword(env, data.employee_password);
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
}

export async function onRequestGet() {
  return json(
    {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "請從頁面輸入工號與密碼查詢。",
    },
    { status: 405 }
  );
}

export async function onRequestPost({ request, env }) {
  try {
    return lookupWinner(request, env, await readJson(request));
  } catch (error) {
    return handleError(error);
  }
}
