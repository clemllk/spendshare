/**
 * SpendShare — Client-side encryption
 * Uses Web Crypto API (AES-GCM 256-bit).
 * The room key is derived from the room ID + user passphrase,
 * never sent to or stored on the server.
 *
 * Flow:
 *  1. User creates/joins a room → derives a CryptoKey from room share code
 *  2. All transaction fields (amount, note, currency, date) are encrypted
 *     before being sent to Supabase
 *  3. Server stores only encrypted blobs + the date bucket for ordering
 *  4. Other room members decrypt with the same derived key
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

/** Derive a room encryption key from the share code (used as passphrase) */
export async function deriveRoomKey(shareCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  // Import share code as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(shareCode.toUpperCase()),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM key (salt = fixed string + share code for determinism)
  const salt = encoder.encode("spendshare_v1_" + shareCode.toUpperCase());
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a JSON-serialisable payload */
export async function encryptPayload(
  data: object,
  key: CryptoKey
): Promise<{ payload: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return {
    payload: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
  };
}

/** Decrypt an encrypted payload back to an object */
export async function decryptPayload<T = Record<string, unknown>>(
  payload: string,
  iv: string,
  key: CryptoKey
): Promise<T> {
  const decoder = new TextDecoder();

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(payload)
  );

  return JSON.parse(decoder.decode(plaintext)) as T;
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
