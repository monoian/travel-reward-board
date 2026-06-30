import { AppError, handleError, json, readJson } from "../../_lib/http.js";
import { createAdminCookie, verifyAdminPassword } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  try {
    const data = await readJson(request);
    const username = String(data.username || "").trim();
    const password = String(data.password || "");

    if (!verifyAdminPassword(env, username, password)) {
      throw new AppError(401, "BAD_LOGIN", "帳號或密碼不正確。");
    }

    const cookie = await createAdminCookie(request, env, username);
    return json(
      { ok: true, message: "登入成功。" },
      { headers: { "set-cookie": cookie } }
    );
  } catch (error) {
    return handleError(error);
  }
}

