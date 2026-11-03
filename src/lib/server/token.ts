import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf: Buffer) => buf.toString("base64url");

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/** `base64url(json).base64url(hmac)` */
export function signToken(payload: object, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${b64url(mac(body, secret))}`;
}

export function verifyToken<T = unknown>(token: string, secret: string): T | null {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  let sig: Buffer;
  try {
    sig = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  const expected = mac(body, secret);
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
