// AES-256-GCM helpers for Google tokens at rest. Pure (key passed in) so they're testable;
// server code supplies the key from GOOGLE_TOKEN_ENCRYPTION_KEY.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc1:";
const keyFrom = (secret: string) => createHash("sha256").update(secret).digest();

export function encryptWith(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

/** Decrypts; values written before encryption (no prefix) are returned unchanged. */
export function decryptWith(secret: string, stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", keyFrom(secret), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}
