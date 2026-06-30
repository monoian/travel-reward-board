import { handleError, json } from "../../_lib/http.js";
import { currentAdmin } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    const admin = await currentAdmin(request, env);
    return json({
      ok: true,
      authenticated: Boolean(admin),
      username: admin ? admin.sub : null,
    });
  } catch (error) {
    return handleError(error);
  }
}

