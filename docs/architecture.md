# Architecture

`foaf-client` contains two artifacts in one repository because they encode the
same FOAF wire contract.

## Ruby

```ruby
verifier = Foaf::Auth::Verifier.new(
  jwks_url: "https://auth.foaf.io/.well-known/jwks.json",
  issuer: "auth.foaf.io",
  audience: "my-app",
  revocations_url: "https://auth.foaf.io/v1/revocations/snapshot",
  service_token: ENV.fetch("FOAF_AUTH_SERVICE_TOKEN")
)
claims = verifier.verify(token)

client = Foaf::LedgerClient.new(base_url: "https://api.foaf.io")
network = client.network(network_address: address)
```

Apps that hold FOAF private keys may inject a signature provider:

```ruby
keys = { wallet_address.downcase => private_key_hex }
client = Foaf::LedgerClient.new(
  base_url: "https://api.foaf.io",
  signature_provider: lambda do |actor_address, exact_body|
    Foaf::LedgerSigner.sign!(keys.fetch(actor_address.downcase), exact_body)
  end
)
```

The provider receives the actor address and the exact JSON body that will be
sent. Confirmation and rejection calls also require `signer_address:` when
signature enforcement is enabled because the pending-transfer ID alone does
not reveal the receiver to the client.

## TypeScript

The package modules are independently importable, but all are delivered by the
same copy-sync:

- `auth`: auth.foaf.io lifecycle client and response mapping.
- `contacts`: canonical FOAF contact-edge reads.
- `ledger`: FOAF networks, trustlines, capacity, transfers, key custody,
  signing, and balance conversion.
- `adapters`: headless data-source boundary for direct FOAF and Rails `/v1`.
- `ui`: controlled React Native components; no Redux or app API singleton.

The direct adapter intentionally provides ledger primitives, not app settlement
policy. Loan/order state transitions remain in their owning apps.
