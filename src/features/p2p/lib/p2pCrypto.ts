const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function generateRsaKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const exported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return { keyPair, publicKeyBase64: toBase64(exported) };
}

export async function importRsaPublicKey(base64: string): Promise<CryptoKey> {
  const keyData = fromBase64(base64);
  return crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function encryptWithPublicKey(key: CryptoKey, plaintext: string): Promise<string> {
  const encoded = encoder.encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, encoded);
  return toBase64(encrypted);
}

export async function decryptWithPrivateKey(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const ciphertext = fromBase64(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, key, ciphertext);
  return decoder.decode(decrypted);
}
