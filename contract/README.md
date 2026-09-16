# MStocks — `trading.compact` (Midnight Preview deployment project)

This folder is the **self-contained deployment project** for the MStocks
confidential test-stock-trading contract: everything needed to compile,
deploy and export it lives here. The repository root contains only this
`contract/` folder and the `frontend/` that consumes its exported artifacts.

```text
<repo root>/
├── contract/                  ← this folder (deploy project)
│   ├── .env                   # deploy configuration (SECRETS — gitignored)
│   ├── trading.compact        # the smart contract (Compact language 0.23)
│   ├── deploy.ts              # compile→sync→deploy→export pipeline
│   ├── balance.ts             # wallet status check (npm run balance)
│   ├── wallet.ts              # wallet facade / sync / DUST helpers
│   ├── witnesses.ts           # private-state witnesses (frontend-reusable)
│   ├── networks.ts            # network endpoints + env overrides
│   ├── load-env.ts            # .env loader
│   ├── package.json           # dependencies + scripts (this project)
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── bootstrap.sh           # Node 22 + npm install helper
│   ├── patches/               # patch-package fix for wallet-sdk-shielded 3.0.2
│   ├── deployment.json        # latest deployment record
│   ├── managed/               # compile output: contract/ keys/ zkir/ compiler/
│   ├── mstocks-level-db/      # encrypted private state (gitignored)
│   └── .wallet-state/         # synced-wallet snapshots (gitignored)
└── frontend/
    └── src/contracts/trading/ # exported deployment artifacts (written by deploy.ts)
```

## Deployment record

| | |
| --- | --- |
| Network | `preview` |
| Contract address | `f6801a4d93e41adc3f1b6851f7b55fdb524faae5ee8919d16d45fea3dbf28bed` |
| Deploy tx hash | `f0b8d0bb1e4b6e7f5351d1bde6c334280730685284edba3ac2fb980d65022eab` |
| Deployed at | 2026-09-14 15:19:21 UTC |
| Deployer wallet | `mn_addr_preview1guqu6wglqh5w0ju5jqvw9qefk0utascde77k6xgcmmc3hzn5n7dsfn5aw0` |
| Toolchain | compactc 0.31.1 · language 0.23.0 · runtime 0.16.0 |

Full record: [`deployment.json`](deployment.json) — mirrored to
`../frontend/src/contracts/trading/deployment.json` by the deploy script.

## Quick start (local system)

Prerequisites:

- **Node ≥ 22** — `@midnightntwrk/wallet-sdk` uses ES2025 `Set` methods.
  `./bootstrap.sh` fetches a local Node 22 into `.cache/node22` automatically
  on Linux if none is present (on macOS install Node 22+ yourself).
- *(Only for recompiling the contract)* the Compact toolchain:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  compact update 0.31        # toolchain 0.31.x = language 0.23
  ```

```bash
cd contract
./bootstrap.sh              # Node 22 (if needed) + npm install (+ patch)
npm run balance             # check wallet funding (fast)
npm run balance -- --full   # also sync shielded/dust (uses snapshot cache)
npm run deploy              # deploy + export artifacts to ../frontend/src/contracts/trading
npm run compile             # recompile trading.compact → managed/ (needs Compact toolchain)
```

`npm run deploy` pipeline: load `.env` → quick funding check (unshielded
wallet) → full wallet sync (shielded + dust; the first cold sync on Preview
took ~18 min — afterwards the snapshot in `.wallet-state/` makes it a
delta-sync of seconds) → DUST registration if needed → `deployContract` via
midnight-js → verify on indexer → export to `FRONTEND_EXPORT_DIR`.

## Configuration (`.env`)

| Variable | Meaning |
| --- | --- |
| `WALLET_SEED` | 24-word BIP-39 mnemonic (Lace-compatible) or 64-hex seed |
| `NETWORK` | `preview` \| `preprod` \| `undeployed` (local devnet) |
| `MN_NODE_URL` / `MN_INDEXER_URL` / `MN_INDEXER_WS` / `MN_PROOF_SERVER_URL` | endpoint overrides |
| `PRIVATE_STATE_PASSWORD` | ≥16 chars, ≥3 character classes (encrypts private state) |
| `FRONTEND_EXPORT_DIR` | where deploy.ts writes artifacts (relative to this folder; default `../frontend/src/contracts/trading`) |

Proof server defaults: Preview uses Midnight's hosted proof server
(`https://proof-server.preview.midnight.network`); to prove fully locally run
`docker run -p 6300:6300 midnightnetwork/proof-server` and set
`MN_PROOF_SERVER_URL=http://localhost:6300`.

## The contract (`trading.compact`)

- **Private** (witnesses / wallet state): cash balance (cents), stock positions,
  order salts, DApp-local secret key.
- **Public ledger**: order commitments → owner DApp pubkey (never price/qty/side
  in the clear), `lastPrice`, `totalVolume`, `activeOrderCount`,
  `verifiedWallets`, `lastFaucetClaim` (7-day faucet cooldown).
- **Circuits**: `verifyWallet`, `claimFaucet`, `depositCash`, `mintTestStock`,
  `placeOrder`, `cancelOrder`, `executeTrade`.
- **Enums**: `Ticker` (AAPL, TSLA, GOOGL, MSFT, AMZN, NVDA, SPY, META, NFLX, AMD),
  `OrderSide` (BUY, SELL).
- Currency: integer cents; faucet pays 100000 cents ($1000) per 7 days per
  verified identity.

## Frontend integration

Everything the frontend needs is exported to
`../frontend/src/contracts/trading/` (see its generated `README.md`): the
compiled contract API, ZK prover/verifier keys, ZKIR, environment-agnostic
witnesses,
`config.ts` (typed constants for the app), and `deployment.json`. Typical usage with the Lace/1AM browser
wallet is to join the deployed contract by address; headless Node usage
mirrors `deploy.ts`.

## Notes / gotchas discovered during this deployment

1. **Node >= 22 required** — `@midnightntwrk/wallet-sdk` uses ES2025
   `Set.prototype.difference` etc. (`bootstrap.sh` provisions Node 22).
2. **wallet-sdk-shielded 3.0.2 bug** — `CoreWallet.pickAllCoins` calls
   `pendingOutputs.values().map(...)` on ledger-v8's native `Map` (iterators
   have no `.map`). Fixed via `patch-package`
   (`patches/@midnightntwrk+wallet-sdk-shielded+3.0.2.patch`), applied
   automatically on `npm install` (postinstall).
3. **Version pins matter** — `@midnight-ntwrk/compact-js` is pinned to 2.5.1
   (2.5.3 depends on an unpublished ledger-v9 alpha) and `ledger-v8` to 8.1.0
   (what midnight-js-protocol 4.1.1 requires). See `overrides` in
   `package.json`.
4. **First wallet sync on Preview** replays ~230k zswap/dust segments (~18 min
   here). Snapshots in `.wallet-state/` make later runs fast, and an
   interrupted cold sync resumes from the last checkpoint.
5. **`mstocks-level-db/`** holds the deployer's encrypted private state for the
   deployed contract (including its maintenance signing key) — keep it backed
   up if you plan to maintain/upgrade the contract from this machine.
