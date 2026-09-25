import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { appSecret, env } from "@/lib/env";

/** AES-256-GCM for sending-account credentials at rest. Format: v1.<iv>.<tag>.<ciphertext> (base64url). */
function key(): Buffer {
  const raw = env.encryptionKey;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
    return buf;
  }
  if (env.isProduction) throw new Error("ENCRYPTION_KEY must be set in production.");
  return createHash("sha256").update(`dev-encryption:${appSecret()}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 signing for tamper-proof public URLs (ported from the WP plugin's Signer). */
export function sign(payload: string, purpose: string): string {
  return createHmac("sha256", `${purpose}:${appSecret()}`).update(payload).digest("base64url").slice(0, 32);
}

export function verify(payload: string, signature: string, purpose: string): boolean {
  const expected = Buffer.from(sign(payload, purpose));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Unsubscribe token: identifies workspace + recipient; no expiry (unsubscribe links must keep working). */
export function unsubscribeToken(workspaceId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify([workspaceId, email.toLowerCase()])).toString("base64url");
  return `${payload}.${sign(payload, "unsubscribe")}`;
}

export function parseUnsubscribeToken(token: string): { workspaceId: string; email: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !verify(payload, sig, "unsubscribe")) return null;
  try {
    const [workspaceId, email] = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof workspaceId === "string" && typeof email === "string" ? { workspaceId, email } : null;
  } catch {
    return null;
  }
}
