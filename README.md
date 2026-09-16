# 🔒 MStocks: Confidential Stock Trading Engine

> **A Privacy-First, Zero-Knowledge Stock Trading Platform on the Midnight Network.**
> MStocks brings traditional stock trading on-chain while keeping user balances, order prices, quantities, and position sizes **100% confidential** using Zero-Knowledge Proofs (ZKPs) and Midnight's Dual-State Ledger.

*(Add a screenshot of your Trade page here, e.g. `![MStocks Platform](./docs/screenshot.png)`)*

---

## 🚀 Live Deployment (Midnight Preview Network)

| Attribute | Value / Endpoint |
| :--- | :--- |
| **Contract Address** | `f6801a4d93e41adc3f1b6851f7b55fdb524faae5ee8919d16d45fea3dbf28bed` |
| **Deploy Tx Hash** | `f0b8d0bb1e4b6e7f5351d1bde6c334280730685284edba3ac2fb980d65022eab` |
| **Network** | `preview` |
| **Node / Indexer** | `https://rpc.preview.midnight.network` / `/api/v4/graphql` |
| **Toolchain** | Compact `0.31.1` · Midnight JS `4.1.1` · Wallet SDK `1.2.0` |

---

## 🎯 The Problem: Public DeFi Is Broken for Serious Traders

In traditional finance (TradFi) and public DeFi (Ethereum, Solana), **order books and balances are entirely visible**:

1. **MEV & Front-Running** — Bots continuously scan public mempools, front-running retail traders and extracting millions in hidden taxes.
2. **Strategy Exposure & Copy Trading** — High-net-worth individuals and hedge funds cannot execute large block trades without revealing their portfolio allocations, entry prices, and overall strategy to the entire world.
3. **Sybil Attacks on Testnets** — Traditional faucets and trading platforms are easily spammed by automated bots, draining resources.

## 💡 The Solution: MStocks

MStocks solves these issues by building on **Midnight Network's Dual-State Ledger Architecture**:

- **Confidential Balances & Positions** — User cash balances (USDC) and stock positions (AAPL, NVDA, etc.) are never written to the blockchain. They are stored securely in local, encrypted client-side state.
- **Opaque Order Commitments** — When a user places a limit order, the price and size are hashed with a secret salt into a 32-byte cryptographic commitment. The public ledger knows an order exists, but cannot read the price, quantity, or side (Buy/Sell).
- **Selective Public Disclosure** — To maintain market integrity and power real-time TradingView charts, only the executed trade prices and aggregate volumes are disclosed publicly on-chain upon settlement.

---

## 🏛️ Architecture: How Midnight Powers MStocks

MStocks is split into two states, bridged by a Zero-Knowledge smart contract (`trading.compact`):

### 1. Private Client State (The Witnesses)

Data lives exclusively in the user's browser (managed via `WalletContext.jsx` and injected via TS witnesses).

- **`cashBalance` & `positions`** — The user's wealth.
- **`secretKey`** — A randomly generated local key, hashed with a DApp tag to create a DApp-specific public key, ensuring the user cannot be tracked across different Midnight applications.
- **`orderSalt`** — A 128-bit random secret used to hash limit orders so identical orders don't produce identical hashes.

### 2. Public Ledger State (The Blockchain)

- **`activeOrders`** — A map linking 32-byte order hashes to DApp public keys.
- **`verifiedWallets`** — A registry of human-verified wallets to prevent Sybil bot attacks.
- **`lastFaucetClaim`** — Enforces a strict 7-day cooldown on the 1,000 USDC faucet at the consensus level.

### 3. Core ZK Circuits

- **`placeOrder`** — The client generates a local ZK proof that balance ≥ order cost. It debits the private state locally and posts only the commitment hash on-chain.
- **`executeTrade`** — Matchers must provide the secret preimages (price/quantity). The circuit mathematically verifies that limits cross correctly (buy price ≥ sell price) without allowing attackers to spoof trades or destroy other users' orders.
- **`cancelOrder`** — Validates that the caller's DApp public key matches the owner of the commitment hash, then unlocks funds back into private state.

### System Diagram

```text
                          ┌────────────────────────────────────────────┐
                          │            CLIENT BROWSER (LOCAL)           │
                          │                                              │
                          │  ┌────────────────────────────────────────┐  │
                          │  │      Encrypted Local Witness State     │  │
                          │  │  • Cash Balance: $10,000 (Hidden)      │  │
                          │  │  • Positions: 100 NVDA, 50 SPY (Hidden)│  │
                          │  │  • Secret DApp Key & Salt (Hidden)     │  │
                          │  └───────────────────┬────────────────────┘  │
                          │                      │                       │
                          │        1. Generates Local ZK Proof           │
                          │           (Client-Side Prover)               │
                          └──────────────────────┬───────────────────────┘
                                                  │
                          2. Submits Proof + Commitment Hash
                             (Price & Size Hidden)
                                                  │
                                                  ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        MIDNIGHT PREVIEW NETWORK                            │
│                                                                             │
│  ┌───────────────────────────────────┐   ┌────────────────────────────┐   │
│  │        Public Ledger State        │   │    On-Chain ZK Circuits    │   │
│  │  • activeOrders: Map<Hash, Owner> │   │  • verifyWallet()          │   │
│  │  • activeOrderCount: Uint<64>     │   │  • claimFaucet()           │   │
│  │  • verifiedWallets: Map<Key,Bool> │   │  • placeOrder()            │   │
│  │  • lastPrice / totalVolume        │   │  • executeTrade()          │   │
│  └───────────────────────────────────┘   └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project File Structure

```text
mstocks/
├── contract/                       # Midnight smart contract & deployment
│   ├── .wallet-state/              # Cached wallet sync data
│   ├── managed/                    # Compiled ZK artifacts (keys, zkir, JS bindings)
│   ├── mstocks-level-db/           # Local private state DB for deployment
│   ├── scripts/
│   │   ├── balance.ts              # CLI wallet balance checker
│   │   ├── bootstrap.sh            # Environment setup script
│   │   ├── deploy.ts               # Deploys contract & exports artifacts to frontend
│   │   ├── load-env.ts             # Environment loader utility
│   │   ├── networks.ts             # Network configurations (Preview/Preprod)
│   │   └── wallet.ts               # Wallet facade & DUST fee manager
│   ├── trading.compact             # Core zero-knowledge smart contract
│   └── witnesses.ts                # Client-side private state witness implementations
│
└── frontend/                       # React + Vite frontend (Neo-Brutalist UI)
    ├── src/
    │   ├── components/             # Reusable UI (Navbar, Footer, TradingView StockChart)
    │   ├── context/
    │   │   └── WalletContext.jsx   # Midnight SDK contract joiner & BigInt state manager
    │   ├── contracts/              # Auto-exported contract artifacts from backend
    │   ├── hooks/
    │   │   └── useLiveStockData.js # Live Finnhub REST + WebSocket quote stream
    │   ├── lib/
    │   │   └── privateState.js     # Witness handlers, stock tickers, logo domains
    │   ├── pages/
    │   │   ├── Faucet.jsx          # 7-day shielded USDC claim page
    │   │   ├── Home.jsx            # Landing page
    │   │   ├── Portfolio.jsx       # Holdings, PnL tracking, wallet verification
    │   │   └── Trade.jsx           # Order entry ticket, live chart, positions
    │   ├── routes/
    │   │   └── RouterConfig.jsx    # React Router setup
    │   ├── App.jsx                 # Root component
    │   └── main.jsx                # Entry point (contains Node.js polyfills for SDK)
    └── vite.config.js              # WASM & top-level-await configuration
```

---

## ⚡ Technical Stack & Integration

- **Smart Contract Language:** Compact (`pragma language_version 0.23;`)
- **ZK Circuit Compiler:** `compactc 0.31.1`
- **Frontend Framework:** React 19 + Vite 8 + Tailwind CSS v4 (Neo-Brutalist design system)
- **Web3 / Midnight SDK:** `@midnight-ntwrk/midnight-js-contracts`, `@midnight-ntwrk/compact-runtime`, `@midnight-ntwrk/wallet-sdk`
- **Live Market Feeds:** Real-time WebSockets via Finnhub API + TradingView Advanced Charting Engine
- **Client Storage:** Encrypted browser storage via a custom BigInt-safe `localStorage` serialization wrapper

## ⚙️ Smart Contract Circuits (`trading.compact`)

| Circuit | Privacy & Execution Logic |
| :--- | :--- |
| `verifyWallet()` | Enforces anti-bot verification by recording the caller's DApp public key in `verifiedWallets`. |
| `claimFaucet()` | Credits 1,000 shielded USDC to private cash state. Enforces human verification and a 7-day cooldown (604,800s) per wallet key. |
| `depositCash()` | Mints test USDC directly into client-side private witness state. |
| `mintTestStock()` | Mints test stock shares into client-side private witness state. |
| `placeOrder()` | Privately verifies that balance ≥ order value (buy) or holding ≥ quantity (sell). Debits private state and posts a 32-byte cryptographic commitment hash to `activeOrders`. |
| `cancelOrder()` | Verifies the caller owns the commitment key, then unlocks locked cash or stock back into private state. |
| `executeTrade()` | Cryptographically recomputes order commitments from preimages. Verifies limits cross (buy price ≥ trade price ≥ sell price) and updates public `lastPrice` and `totalVolume`. |

---

## ✨ Features

- **10 Synthetic Assets** — Live trading for `AAPL`, `TSLA`, `GOOGL`, `MSFT`, `AMZN`, `NVDA`, `SPY`, `META`, `NFLX`, and `AMD`.
- **Live Market Data** — Real-time WebSockets via Finnhub API combined with an interactive TradingView Advanced Charting Engine.
- **Real-Time PnL Tracking** — Accurate tracking of average entry price, unrealized PnL, and realized PnL based on cryptographic trade history.
- **Neo-Brutalist UI** — A high-contrast, premium frontend design tailored for pro traders.

---

## 🧪 How to Evaluate & Test MStocks (For Judges)

MStocks is deployed to the Midnight Preview Network. Follow these steps to experience confidential trading:

### Step 1: Wallet Setup

1. Install the **Midnight Lace Extension** in your Chromium-based browser.
2. Open Lace and switch the network setting to **Preview Network**.
3. Fund your wallet with `tNIGHT` tokens via the [Midnight Preview Faucet](https://midnight-tmnight-preview.nethermind.dev/).

### Step 2: Verification & Funding

1. Visit the deployed MStocks frontend.
2. Click **Connect Lace** in the Navbar.
3. Navigate to the **Portfolio** tab — you'll see an "Unverified" status.
4. Click **Verify Now**. This triggers the `verifyWallet` ZK circuit, registering your wallet on-chain as a human user.
5. Navigate to the **Faucet** tab and click **Claim $1000 Shielded USDC**. A local ZK proof is generated, and the funds are injected directly into your private, encrypted client-side state.

### Step 3: Confidential Trading

1. Navigate to the **Trade** tab.
2. Select an asset (e.g., `NVDA`) and ensure the live chart is loading.
3. In the Execution panel, leave it on **Market** order and buy 5 shares.
4. Watch the ZK proof compile locally (`Compiling ZK Proof...`) and submit the confidential transaction.
5. Once confirmed, check the **Positions** and **Trades** tabs below the chart — your unrealized PnL updates in real time based on live WebSocket market data.

---

## 💻 Local Developer Setup

If you wish to run the frontend locally or redeploy the contract:

### Prerequisites

- Node.js `v22.0.0+`
- Docker (required for the local ZK proof server)

### 1. Start the ZK Proof Server

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0 -- midnight-proof-server -v
```

### 2. Install Dependencies & Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Deploying the Contract (Optional)

Ensure your `contract/.env` contains your `WALLET_SEED` and `PRIVATE_STATE_PASSWORD`, then inside the `contract/` folder run:

```bash
npm install
npm run compact
npm run deploy
```

The script automatically exports the new contract address and ZK keys directly into the frontend directory.

---

## 📜 License

This project is licensed under the MIT License.