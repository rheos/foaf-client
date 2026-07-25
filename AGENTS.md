# foaf-client

Shared client SDK for the FOAF ecosystem.

## Package boundary

- `gem/` is the Ruby backend package. It exposes `Foaf::Auth` and `Foaf::Ledger`.
- `client/` is the TypeScript/React Native package. It exposes `auth`, `contacts`,
  `ledger`, `adapters`, and `ui` entry points.
- `contracts/` contains wire fixtures shared by both implementations.

Dependency direction is `ledger -> contacts -> auth`. Auth and contacts must not
depend on ledger code.

## Protocol constraints

- FOAF write signatures are Ethereum `personal_sign` signatures over the exact
  UTF-8 request body sent on the wire.
- Read failures return `nil` in Ruby and throw in TypeScript.
- Mutating transfer calls preserve status and response body.
- `max-capacity-path-info` must include `address` in the JSON body until the
  upstream route/controller parameter mismatch is fixed.
- Balance conversion is pure: viewer balance is the negated FOAF balance;
  `received` is the viewer's credit limit and `given` is the counterparty's.

## Tests

Use Docker:

```bash
docker compose run --rm gem
docker compose run --rm client
```

Live FOAF contract tests are opt-in with `INTEGRATION=1`.

