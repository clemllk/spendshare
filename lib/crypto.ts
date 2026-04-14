const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

export async function deriveRoomKey(shareCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(shareCode.toUpperCase()),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const salt = encoder.encode("spendshare_v1_" + shareCode.toUpperCase());
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPayload(data: object, key: CryptoKey): Promise<{ payload: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  return { payload: bufferToBase64(ciphertext), iv: bufferToBase64(iv) };
}

export async function decryptPayload<T = Record<string, unknown>>(payload: string, iv: string, key: CryptoKey): Promise<T> {
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
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}
