import {
  getPublicKey,
  signSync,
  utils as secpUtils,
} from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  utf8ToBytes,
} from '@noble/hashes/utils';

if (!secpUtils.hmacSha256Sync) {
  secpUtils.hmacSha256Sync = (key, ...messages) =>
    hmac(sha256, key, concatBytes(...messages));
}

function privateKeyBytes(privateKey: string): Uint8Array {
  return hexToBytes(privateKey.replace(/^0x/, ''));
}

export function personalMessageHash(payload: string): Uint8Array {
  const message = utf8ToBytes(payload);
  const prefix = utf8ToBytes(`\u0019Ethereum Signed Message:\n${message.length}`);
  return keccak_256(concatBytes(prefix, message));
}

/** Ethereum personal_sign wire format: 32-byte r + 32-byte s + recovery v. */
export function signPayload(privateKey: string, payload: string): string {
  const [signature, recovery] = signSync(
    personalMessageHash(payload),
    privateKeyBytes(privateKey),
    { canonical: true, der: false, recovered: true },
  );
  return `0x${bytesToHex(concatBytes(signature, Uint8Array.of(27 + recovery)))}`;
}

export function addressFromPrivateKey(privateKey: string): string {
  const publicKey = getPublicKey(privateKeyBytes(privateKey), false);
  const digest = keccak_256(publicKey.slice(1));
  return `0x${bytesToHex(digest.slice(-20))}`;
}

export function createPrivateKeySignatureProvider(
  getPrivateKey: (address: string) => Promise<string | null> | string | null,
) {
  return async (address: string, payload: string): Promise<string | null> => {
    const privateKey = await getPrivateKey(address);
    if (!privateKey) return null;
    if (addressFromPrivateKey(privateKey).toLowerCase() !== address.toLowerCase()) {
      throw new Error('FOAF private key does not match the requested signer address');
    }
    return signPayload(privateKey, payload);
  };
}
