function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(passphrase, saltBytes, iterations) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(passphrase, payload, options = {}) {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('WebCrypto 不可用');
  if (!passphrase) throw new Error('缺少加密口令');

  const iterations = Number(options.iterations ?? 150_000);
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveAesKey(passphrase, saltBytes, iterations);
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));

  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, plaintext);
  const ciphertextBytes = new Uint8Array(ciphertextBuf);

  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iter: iterations,
    salt: toBase64(saltBytes),
    iv: toBase64(ivBytes),
    ct: toBase64(ciphertextBytes),
  };
}

export async function decryptJson(passphrase, envelope) {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('WebCrypto 不可用');
  if (!passphrase) throw new Error('缺少解密口令');
  if (!envelope || typeof envelope !== 'object') throw new Error('无效密文格式');
  if (envelope.v !== 1) throw new Error(`不支持的密文版本: ${String(envelope.v)}`);

  const iterations = Number(envelope.iter);
  if (!Number.isFinite(iterations) || iterations <= 0) throw new Error('无效 KDF 参数');

  const saltBytes = fromBase64(String(envelope.salt || ''));
  const ivBytes = fromBase64(String(envelope.iv || ''));
  const ctBytes = fromBase64(String(envelope.ct || ''));

  const key = await deriveAesKey(passphrase, saltBytes, iterations);
  const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ctBytes);
  const decoder = new TextDecoder();
  const jsonText = decoder.decode(new Uint8Array(plaintextBuf));
  return JSON.parse(jsonText);
}

