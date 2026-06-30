import { handleError, json } from "../../_lib/http.js";
import { clearAdminCookie } from "../../_lib/session.js";

export async function onRequestPost({ request }) {
  try {
    return json(
      { ok: true, message: "已登出。" },
      { headers: { "set-cookie": clearAdminCookie(request) } }
    );
  } catch (error) {
    return handleError(error);
  }
}

