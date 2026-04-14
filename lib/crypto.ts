const ALG = "AES-GCM";

export async function deriveRoomKey(shareCode: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey(
    "raw", enc.encode(shareCode.toUpperCase()),
    { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("spendshare_v1_" + shareCode.toUpperCase()), iterations: 100000, hash: "SHA-256" },
    raw,
    { name: ALG, length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

export async function encrypt(data: object, key: CryptoKey): Promise<{ payload: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: ALG, iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return { payload: toB64(buf), iv: toB64(iv) };
}

export async function decrypt<T>(payload: string, iv: string, key: CryptoKey): Promise<T> {
  const buf = await crypto.subtle.decrypt(
    { name: ALG, iv: fromB64(iv) },
    key,
    fromB64(payload)
  );
  return JSON.parse(new TextDecoder().decode(buf)) as T;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
}

function fromB64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}
