# @foaf/client

The TypeScript side of `foaf-client`. Import its internal modules from the
synced source tree:

```ts
import { FoafAuthClient } from '@protocol/foaf-client/auth';
import { FoafContactsClient } from '@protocol/foaf-client/contacts';
import { FoafLedgerClient } from '@protocol/foaf-client/ledger';
import { RailsV1Adapter } from '@protocol/foaf-client/adapters';
import { ContactCard } from '@protocol/foaf-client/ui';
```

Apps inject token/key storage, signer key lookup, HTTP clients, and UI theme
tokens. The package contains no Redux or app-specific profile/order behavior.

Run tests and type checking through Docker from the repository root:

```bash
docker compose run --rm client
```
