import { PushSubscriptionKeys } from './types';

// Utility to convert Base64URL string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Utility to convert Uint8Array / ArrayBuffer to Base64URL
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Creates a signed VAPID JWT Authorization header according to RFC 8292
 */
export async function createVapidHeader(
  audience: string,
  subject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  expirationSeconds: number = 12 * 3600
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + expirationSeconds,
    sub: subject
  };

  const headerB64 = bufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = bufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key (JWK format or PKCS8/raw ECDSA P-256)
  let privateKey: CryptoKey;
  try {
    const rawKey = urlBase64ToUint8Array(vapidPrivateKey);
    privateKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: vapidPrivateKey,
        x: vapidPublicKey.slice(0, 43), // fallback if formatted as JWK component
        y: vapidPublicKey.slice(43)
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } catch {
    // If formatted as raw 32-byte scalar d
    const dBytes = urlBase64ToUint8Array(vapidPrivateKey);
    const pubBytes = urlBase64ToUint8Array(vapidPublicKey);
    // Uncompressed point starts with 0x04 followed by 32 bytes X and 32 bytes Y
    const x = bufferToBase64Url(pubBytes.slice(1, 33));
    const y = bufferToBase64Url(pubBytes.slice(33, 65));
    const d = bufferToBase64Url(dBytes);

    privateKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x,
        y,
        d
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = bufferToBase64Url(signature);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: `p256ecdsa=${vapidPublicKey}`
  };
}

/**
 * Encrypts a push message payload according to RFC 8291 (aes128gcm)
 */
export async function encryptPushPayload(
  payloadText: string,
  userKeys: PushSubscriptionKeys
): Promise<{ body: ArrayBuffer; contentEncoding: string }> {
  const p256dh = urlBase64ToUint8Array(userKeys.p256dh);
  const auth = urlBase64ToUint8Array(userKeys.auth);

  // 1. Generate local ephemeral EC key pair
  const localKeyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair;

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  );

  // 2. Import subscriber's public key
  const userPublicKey = await crypto.subtle.importKey(
    'raw',
    p256dh.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. Derive shared secret (ECDH)
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: userPublicKey },
    localKeyPair.privateKey,
    256
  );

  // 4. Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. RFC 8291 Section 3.2 HKDF sequence:
  // Step 5.1: prk1 = HMAC-SHA-256(key=auth, data=sharedSecret)
  const authKey = await crypto.subtle.importKey(
    'raw',
    auth.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk1 = await crypto.subtle.sign('HMAC', authKey, sharedSecret);

  // Step 5.2: secret = HMAC-SHA-256(key=prk1, data="WebPush: info\0" || userPub || localPub || 0x01)
  const prk1Key = await crypto.subtle.importKey(
    'raw',
    prk1,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const infoPrefix = new TextEncoder().encode('WebPush: info\0');
  const info1 = new Uint8Array(infoPrefix.length + p256dh.length + localPublicKeyRaw.length + 1);
  info1.set(infoPrefix, 0);
  info1.set(p256dh, infoPrefix.length);
  info1.set(localPublicKeyRaw, infoPrefix.length + p256dh.length);
  info1[info1.length - 1] = 1;
  const secret = await crypto.subtle.sign('HMAC', prk1Key, info1);

  // Step 5.3: prk2 = HMAC-SHA-256(key=salt, data=secret)
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk2 = await crypto.subtle.sign('HMAC', saltKey, secret);

  // Step 5.4: CEK = HMAC-SHA-256(key=prk2, data="Content-Encoding: aes128gcm\0" || 0x01).slice(0, 16)
  const prk2Key = await crypto.subtle.importKey(
    'raw',
    prk2,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0\x01');
  const keyFull = await crypto.subtle.sign('HMAC', prk2Key, cekInfo);
  const key = new Uint8Array(keyFull).slice(0, 16);

  // Step 5.5: Nonce = HMAC-SHA-256(key=prk2, data="Content-Encoding: nonce\0" || 0x01).slice(0, 12)
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0\x01');
  const nonceFull = await crypto.subtle.sign('HMAC', prk2Key, nonceInfo);
  const nonce = new Uint8Array(nonceFull).slice(0, 12);

  // 6. Format payload according to aes128gcm (RFC 8188)
  const aesKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Record: plaintext + \x02 (delimiter)
  const payloadBytes = new TextEncoder().encode(payloadText);
  const record = new Uint8Array(payloadBytes.length + 1);
  record.set(payloadBytes, 0);
  record[payloadBytes.length] = 2; // Delimiter for final record

  const encryptedRecord = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      record
    )
  );

  // Header:
  // salt (16 bytes) || rs (4 bytes = 4096 = 0x00, 0x00, 0x10, 0x00) || idlen (1 byte = 65) || localPublicKey (65 bytes)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // Record size 4096 (network byte order)
  header[16] = 0x00;
  header[17] = 0x00;
  header[18] = 0x10;
  header[19] = 0x00;
  // Key ID length (65 bytes for uncompressed P-256 public key)
  header[20] = 65;
  header.set(localPublicKeyRaw, 21);

  // Combine header and encrypted record
  const fullBody = new Uint8Array(header.length + encryptedRecord.length);
  fullBody.set(header, 0);
  fullBody.set(encryptedRecord, header.length);

  return {
    body: fullBody.buffer,
    contentEncoding: 'aes128gcm'
  };
}

/**
 * Sends a Web Push notification to an endpoint
 */
export async function sendWebPush(
  endpoint: string,
  userKeys: PushSubscriptionKeys,
  payload: { title: string; body: string; url?: string; data?: any },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ status: number; ok: boolean; statusText: string }> {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;

  const { authorization } = await createVapidHeader(
    audience,
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );

  const payloadString = JSON.stringify(payload);
  const { body, contentEncoding } = await encryptPushPayload(payloadString, userKeys);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Encoding': contentEncoding,
      'Content-Type': 'application/octet-stream',
      'TTL': '86400', // 24 hours
      'Urgency': 'high'
    },
    body
  });

  const responseText = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    statusText: responseText || response.statusText
  };
}

/**
 * Generates an ECDSA P-256 VAPID keypair in raw base64url format
 */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;

  const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const jwkPriv = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey;

  return {
    publicKey: bufferToBase64Url(rawPub),
    privateKey: jwkPriv.d!
  };
}
