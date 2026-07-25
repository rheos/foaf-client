import {
  createPrivateKeySignatureProvider,
  FoafLedgerClient,
} from '../../src/ledger';

const integration = process.env.INTEGRATION === '1' ? describe : describe.skip;

integration('FOAF TypeScript wire-signature contract', () => {
  it('settles a signed transfer while signature enforcement is enabled', async () => {
    if (process.env.FOAF_SIGNATURE_ENFORCEMENT !== 'true') {
      throw new Error('FOAF_SIGNATURE_ENFORCEMENT=true is required');
    }
    const privateKeys = new Map<string, string>();
    const client = new FoafLedgerClient({
      baseUrl: process.env.FOAF_API_URL ?? 'http://host.docker.internal:3002',
      signatureProvider: createPrivateKeySignatureProvider(
        (address) => privateKeys.get(address.toLowerCase()) ?? null,
      ),
    });
    const networkAddress = process.env.FOAF_NETWORK_ADDRESS;
    if (!networkAddress) throw new Error('FOAF_NETWORK_ADDRESS is required');
    const lender = await client.createKeypair();
    const borrower = await client.createKeypair();
    privateKeys.set(lender.address.toLowerCase(), lender.privateKey);
    privateKeys.set(borrower.address.toLowerCase(), borrower.privateKey);

    await client.updateTrustline({
      networkAddress,
      creditorAddress: lender.address,
      debtorAddress: borrower.address,
      creditlineGiven: '100',
      creditlineReceived: '0',
    });
    await client.updateTrustline({
      networkAddress,
      creditorAddress: borrower.address,
      debtorAddress: lender.address,
      creditlineGiven: '0',
      creditlineReceived: '100',
    });
    const pending = await client.createPendingTransfer({
      networkAddress,
      fromAddress: borrower.address,
      toAddress: lender.address,
      value: '1.25',
      extraData: { contract: 'foaf-client-typescript' },
    });
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;

    const confirmed = await client.confirmTransfer(pending.data.id, lender.address);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) expect(confirmed.data.operation).toBeTruthy();
  });
});
