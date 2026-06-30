import { AppError } from "./http.js";

const COOKIE_NAME = "travel_reward_admin";
const SESSION_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(signature);
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const found = cookies.find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : "";
}

function adminConfig(env) {
  const username = String(env.ADMIN_USERNAME || "").trim();
  const password = String(env.ADMIN_PASSWORD || "");
  const secret = String(env.ADMIN_SESSION_SECRET || "");

  if (!username || !password || secret.length < 16) {
    throw new AppError(
      500,
      "ADMIN_CONFIG_MISSING",
      "管理員帳號、密碼或登入密鑰尚未設定完成。請到 Cloudflare Pages 的 Variables and Secrets 補齊。"
    );
  }

  return { username, password, secret };
}

function secureCookiePart(request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export function verifyAdminPassword(env, username, password) {
  const config = adminConfig(env);
  return username === config.username && password === config.password;
}

export async function createAdminCookie(request, env, username) {
  const config = adminConfig(env);
  const payload = {
    sub: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(config.secret, body);
  const token = `${body}.${signature}`;

  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secureCookiePart(
    request
  )}; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminCookie(request) {
  return `${COOKIE_NAME}=; HttpOnly${secureCookiePart(
    request
  )}; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function currentAdmin(request, env) {
  const config = adminConfig(env);
  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = await hmac(config.secret, body);
  if (!sameText(signature, expected)) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlDecode(body)));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return null;
    if (payload.sub !== config.username) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin(request, env) {
  const admin = await currentAdmin(request, env);
  if (!admin) {
    throw new AppError(401, "UNAUTHORIZED", "請先登入管理員後台。");
  }
  return admin;
}

