import { recoverPublicKey } from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  addressFromPrivateKey,
  createKeypairStore,
  FoafLedgerClient,
  personalMessageHash,
  signPayload,
  viewerBalance,
} from '../src/ledger';

function response(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  } as Response;
}

describe('FoafLedgerClient', () => {
  it('sends the address workaround in max-capacity requests', async () => {
    const fetcher = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        response(200, { capacity: '12', path: [] }),
    );
    const client = new FoafLedgerClient({
      baseUrl: 'https://foaf.test',
      fetch: fetcher as unknown as typeof fetch,
    });
    await client.maxCapacityPathInfo('network', 'sender', 'receiver');
    const fixture = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../contracts/max-capacity-path-info.request.json'),
        'utf8',
      ),
    ) as Record<string, string>;

    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
      ...fixture,
      address: 'network',
      from: 'sender',
      to: 'receiver',
    });
  });

  it('signs the exact serialized transfer body and preserves failures', async () => {
    const signed: string[] = [];
    const fetcher = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        response(422, '{"error":"InsufficientCapacity"}'),
    );
    const client = new FoafLedgerClient({
      baseUrl: 'https://foaf.test',
      fetch: fetcher as unknown as typeof fetch,
      signatureProvider: (_address, body) => {
        signed.push(body);
        return '0xsigned';
      },
    });
    const result = await client.createPendingTransfer({
      networkAddress: 'network',
      fromAddress: 'sender',
      toAddress: 'receiver',
      value: '6.80',
    });
    const init = fetcher.mock.calls[0][1] as RequestInit;

    expect(signed).toEqual([init.body]);
    expect((init.headers as Record<string, string>)['X-Signature']).toBe('0xsigned');
    expect(result).toEqual({
      ok: false,
      status: 422,
      error: '{"error":"InsufficientCapacity"}',
    });
  });
});

describe('ledger cryptography and custody', () => {
  const privateKey = '0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8412f4603b6b78690d';

  it('emits a recoverable Ethereum personal_sign signature', () => {
    const payload = '{"value":"6.80"}';
    const signature = signPayload(privateKey, payload);
    const compact = signature.slice(2, 130);
    const recovery = Number.parseInt(signature.slice(130), 16) - 27;
    const publicKey = recoverPublicKey(personalMessageHash(payload), compact, recovery, false);
    const digest = keccak_256(publicKey.slice(1));

    expect(`0x${bytesToHex(digest.slice(-20))}`).toBe(addressFromPrivateKey(privateKey));
    expect(signature).toHaveLength(132);
  });

  it('stores and clears keypairs through an injected adapter', async () => {
    const values = new Map<string, string>();
    const store = createKeypairStore({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    });
    const keypair = {
      address: addressFromPrivateKey(privateKey),
      publicKey: 'public',
      privateKey,
    };
    await store.set(keypair);
    expect(await store.get()).toEqual(keypair);
    await store.clear();
    expect(await store.get()).toBeNull();
  });

  it('flips a trustline into the counterparty perspective', () => {
    expect(
      viewerBalance(
        { balance: '8.50', creditline_given: '40', creditline_received: '25' },
        '0xviewer',
        '0xowner',
      ),
    ).toEqual({
      balance: '-8.50',
      creditlineGiven: '25',
      creditlineReceived: '40',
    });
  });
});
