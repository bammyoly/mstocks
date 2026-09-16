/**
 * MStocks — deploy trading.compact to the Midnight network configured in
 * contract/.env (default: Preview testnet) and export the deployment
 * artifacts for the frontend.
 *
 * Usage (from the project root):
 *   npm run deploy
 *
 * Pipeline:
 *   1. Load contract/.env, resolve network + endpoints.
 *   2. Derive the deployer wallet from WALLET_SEED (mnemonic or hex seed).
 *   3. Quick funding check via the unshielded wallet (fast).
 *      - No tNIGHT -> print the wallet address + faucet URL and wait.
 *   4. Build the full wallet facade (shielded + unshielded + dust) and sync.
 *      A cold sync on a public network can take a long time; state snapshots
 *      are checkpointed to contract/.wallet-state/<network>.json so an
 *      interrupted run resumes from the last checkpoint.
 *   5. If the wallet has no DUST, register NIGHT UTXOs for DUST generation
 *      (Midnight fees are paid in DUST) and wait for generation to start.
 *   6. Wire midnight-js providers (indexer, proof server, level private
 *      state) and deploy the compiled contract.
 *   7. Verify the contract is visible through the indexer.
 *   8. Export artifacts to FRONTEND_EXPORT_DIR (default
 *      ../frontend/src/contracts/trading):
 *        contract/          TypeScript/JS contract API
 *        keys/ + zkir/      ZK proving/verifying keys + ZK IR
 *        contract-info.json compiler/toolchain metadata
 *        witnesses.ts       private-state witnesses (frontend-adapted import)
 *        deployment.json    address, tx hash, block height, endpoints, deployer info
 *        config.ts          typed constants for the frontend app (address, endpoints)
 *        README.md          usage notes for the frontend
 */
import './load-env.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type { FacadeState, WalletFacade } from '@midnightntwrk/wallet-sdk';
import * as TradingContract from './managed/contract/index.js';
import { resolveNetwork, type NetworkConfig } from './networks.js';
import {
  buildFacade,
  buildUnshieldedWallet,
  deriveWalletKeys,
  dustBalance,
  registerForDustGeneration,
  resolveSeed,
  saveWalletSnapshot,
  startSyncHeartbeat,
  unshieldedAddressOf,
  unshieldedBalanceOf,
  unshieldedNightBalance,
  waitForSync,
  withTimeout,
  type WalletKeys,
} from './wallet.js';
import { createWitnesses, emptyTradingPrivateState } from './witnesses.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MANAGED_DIR = path.resolve(here, 'managed');
const CONTRACT_TAG = 'trading';
const PRIVATE_STATE_ID = 'tradingPrivateState';

const RESTORED_SYNC_TIMEOUT_MS = 15 * 60_000; // bound only for restored (delta) syncs
const DUST_TIMEOUT_MS = 20 * 60_000;
const FAUCET_WAIT_MS = 10 * 60_000; // how long to wait for the user to fund

const log = (msg: string): void => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const banner = (lines: readonly string[]): void =>
  console.log('\n' + lines.join('\n') + '\n');

// ---------------------------------------------------------------------------
// Frontend export
// ---------------------------------------------------------------------------

export interface DeploymentRecord {
  network: string;
  contractTag: string;
  privateStateId: string;
  contractAddress: string;
  txHash: string | null;
  blockHeight: number | null;
  deployedAt: string;
  endpoints: {
    indexer: string;
    indexerWS: string;
    node: string;
    proofServer: string;
  };
  toolchain: {
    compactc: string;
    language: string;
    runtime: string;
  };
  deployer: {
    coinPublicKey: string;
    unshieldedAddress: string;
  };
  circuits: readonly string[];
  faucet: string | null;
  constants: Record<string, number>;
}

const circuitListFrom = (): readonly string[] => {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(MANAGED_DIR, 'compiler', 'contract-info.json'), 'utf8'));
    return (info.circuits as { name: string }[]).map((c) => c.name);
  } catch {
    return [];
  }
};

// Best-effort lookup of the block that included the deploy transaction
// (indexer v4: transactions(offset: {hash}) → block.height).
const lookupBlockHeight = async (indexerUrl: string, txHash: string): Promise<number | null> => {
  try {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'query($hash: HexEncoded!) { transactions(offset: {hash: $hash}) { block { height } } }',
        variables: { hash: txHash },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { transactions?: { block?: { height?: number } }[] } };
    return json.data?.transactions?.[0]?.block?.height ?? null;
  } catch {
    return null;
  }
};

export const frontendReadme = (r: DeploymentRecord): string => `# MStocks — trading contract artifacts

Auto-generated by \`contract/deploy.ts\` on ${r.deployedAt}.

## What is here

| Path | Purpose |
| --- | --- |
| \`contract/\` | Compiled contract API (\`index.js\` + \`index.d.ts\`): \`Contract\` class, \`ledger()\` decoder, \`Ticker\`/\`OrderSide\` enums |
| \`keys/\` | ZK proving (\`.prover\`) and verifying (\`.verifier\`) keys per circuit |
| \`zkir/\` | Zero-Knowledge IR per circuit (\`.zkir\` + \`.bzkir\`) |
| \`contract-info.json\` | Compiler / language / runtime versions and circuit metadata |
| \`witnesses.ts\` | Private-state witnesses (\`createWitnesses\`, \`TradingPrivateState\`) — frontend-ready import |
| \`deployment.json\` | Deployed contract address, tx hash, block height, endpoints, deployer identity |
| \`config.ts\` | Typed constants: \`TRADING_CONTRACT_ADDRESS\`, network, endpoints, deployment details |

## Deployment

\`\`\`json
${JSON.stringify({ network: r.network, contractAddress: r.contractAddress, txHash: r.txHash }, null, 2)}
\`\`\`

## Using from the frontend

\`\`\`ts
import { Contract, ledger, Ticker, OrderSide } from '../contracts/trading/contract/index.js';
import { createWitnesses, emptyTradingPrivateState } from '../contracts/trading/witnesses.js';
import { TRADING_CONTRACT_ADDRESS } from '../contracts/trading/config.js';

// 1) With the Lace / 1AM browser wallet (dapp-connector), join the deployed
//    contract by address and let the wallet prove + balance transactions:
const contractAddress = TRADING_CONTRACT_ADDRESS;

// 2) Headless (midnight-js in Node or bundlers) — see contract/deploy.ts in
//    the repo for the full provider wiring (indexer + proof server + level
//    private state).
\`\`\`

### Serving the ZK config

If you use \`FetchZkConfigProvider\` in the browser, serve \`zkir/\` and \`keys/\`
as static files (e.g. copy into \`public/\`) and point the provider at that URL.

## Contract reference

- Circuits: ${r.circuits.join(', ')}
- Enum \`Ticker\`: AAPL, TSLA, GOOGL, MSFT, AMZN, NVDA, SPY, META, NFLX, AMD (0–9)
- Enum \`OrderSide\`: BUY = 0, SELL = 1
- Currency: integer **cents** (1 USDC = 100 units)
- Faucet circuit: pays ${r.constants.FAUCET_AMOUNT_CENTS / 100} USDC (${r.constants.FAUCET_AMOUNT_CENTS} cents) once every ${r.constants.FAUCET_COOLDOWN_SECS / 86400} days per verified DApp identity
- Public ledger: \`activeOrderCount\`, \`lastPrice\`, \`totalVolume\`, \`activeOrders\`, \`verifiedWallets\`, \`lastFaucetClaim\`
- Read the public ledger state with \`ledger(stateValue)\` (see \`contract/index.d.ts\`)

## Network endpoints

| Endpoint | URL |
| --- | --- |
| Indexer (HTTP) | ${r.endpoints.indexer} |
| Indexer (WS) | ${r.endpoints.indexerWS} |
| Node RPC | ${r.endpoints.node} |
| Proof server | ${r.endpoints.proofServer} |
${r.faucet ? `\nTestnet faucet: ${r.faucet}\n` : ''}
Toolchain: compactc ${r.toolchain.compactc} · language ${r.toolchain.language} · runtime ${r.toolchain.runtime}
`;

/** Typed frontend constants (config.ts) mirroring the deployment record. */
export const frontendConfig = (r: DeploymentRecord): string => {
  const dep = (name: string): string => {
    try {
      const pj = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      return (pj.dependencies?.[name] ?? 'unknown').replace(/^[~^]/, '');
    } catch {
      return 'unknown';
    }
  };
  const circuits = JSON.stringify(r.circuits, null, 2).replace(/\n/g, '\n  ');
  return `// AUTO-GENERATED by contract/deploy.ts on ${r.deployedAt}.
// Deployment of the mstocks trading contract.

export const TRADING_CONTRACT_ADDRESS = '${r.contractAddress}';
export const TRADING_NETWORK = '${r.network}';
export const TRADING_PRIVATE_STATE_ID = '${r.privateStateId}';

export const TRADING_DEPLOYMENT = {
  "contractName": "Trading",
  "contractAddress": ${JSON.stringify(r.contractAddress)},
  "privateStateId": ${JSON.stringify(r.privateStateId)},
  "network": ${JSON.stringify(r.network)},
  "deployedAt": ${JSON.stringify(r.deployedAt)},
  "deployTxId": ${JSON.stringify(r.txHash)},
  "blockHeight": ${r.blockHeight ?? 'null'},
  "circuits": ${circuits},
  "versions": {
    "compactCompiler": ${JSON.stringify(r.toolchain.compactc)},
    "language": ${JSON.stringify(r.toolchain.language)},
    "compactRuntime": ${JSON.stringify(r.toolchain.runtime)},
    "midnightJs": ${JSON.stringify(dep('@midnight-ntwrk/midnight-js'))},
    "walletSdk": ${JSON.stringify(dep('@midnightntwrk/wallet-sdk'))}
  },
  "endpoints": {
    "indexer": ${JSON.stringify(r.endpoints.indexer)},
    "indexerWS": ${JSON.stringify(r.endpoints.indexerWS)},
    "node": ${JSON.stringify(r.endpoints.node)},
    "proofServer": ${JSON.stringify(r.endpoints.proofServer)}
  }
} as const;

export const TRADING_INDEXER_URL = '${r.endpoints.indexer}';
export const TRADING_INDEXER_WS = '${r.endpoints.indexerWS}';
export const TRADING_NODE_URL = '${r.endpoints.node}';
export const TRADING_PROOF_SERVER_URL = '${r.endpoints.proofServer}';
${r.faucet ? `\n// Testnet faucet (for funding player wallets — the deployer is already funded):\nexport const TRADING_FAUCET_URL = '${r.faucet}';\n` : ''}`;
};

export function exportArtifacts(r: DeploymentRecord): { exportDir: string; files: number } {
  const exportDir = path.resolve(here, process.env.FRONTEND_EXPORT_DIR ?? '../frontend/src/contracts/trading');
  fs.rmSync(exportDir, { recursive: true, force: true });
  fs.mkdirSync(exportDir, { recursive: true });

  // Compiled contract API + ZK assets
  fs.cpSync(path.join(MANAGED_DIR, 'contract'), path.join(exportDir, 'contract'), { recursive: true });
  fs.cpSync(path.join(MANAGED_DIR, 'keys'), path.join(exportDir, 'keys'), { recursive: true });
  fs.cpSync(path.join(MANAGED_DIR, 'zkir'), path.join(exportDir, 'zkir'), { recursive: true });
  fs.copyFileSync(
    path.join(MANAGED_DIR, 'compiler', 'contract-info.json'),
    path.join(exportDir, 'contract-info.json'),
  );

  // Witnesses, with the managed-import path rewritten for this layout
  const witnessesSrc = fs
    .readFileSync(path.join(here, 'witnesses.ts'), 'utf8')
    .replace('./managed/contract/index.js', './contract/index.js');
  fs.writeFileSync(path.join(exportDir, 'witnesses.ts'), witnessesSrc, 'utf8');

  // Deployment record + docs
  fs.writeFileSync(path.join(exportDir, 'deployment.json'), `${JSON.stringify(r, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'config.ts'), frontendConfig(r), 'utf8');
  fs.writeFileSync(path.join(exportDir, 'README.md'), frontendReadme(r), 'utf8');

  // Also keep a copy next to the contract for the repo
  fs.writeFileSync(path.resolve(here, 'deployment.json'), `${JSON.stringify(r, null, 2)}\n`, 'utf8');

  let files = 0;
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else files += 1;
    }
  };
  walk(exportDir);
  return { exportDir, files };
}

// ---------------------------------------------------------------------------
// midnight-js provider wiring
// ---------------------------------------------------------------------------

const makeWalletProvider = (wallet: WalletFacade, keys: WalletKeys, state: FacadeState) => {
  const coinPublicKey = state.shielded.coinPublicKey.toHexString();
  const encryptionPublicKey = state.shielded.encryptionPublicKey.toHexString();
  return {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
    balanceTx: async (tx: unknown, ttl?: Date) => {
      const recipe = await wallet.balanceUnboundTransaction(
        tx as never,
        { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signed = await wallet.signRecipe(recipe, (payload: Uint8Array) =>
        keys.unshieldedKeystore.signData(payload),
      );
      return wallet.finalizeRecipe(signed);
    },
    submitTx: (tx: unknown) => wallet.submitTransaction(tx as never),
  };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // --- 1. Environment ------------------------------------------------------
  const { name: networkName, config: cfg } = resolveNetwork();
  const password = process.env.PRIVATE_STATE_PASSWORD;
  if (!password) throw new Error('PRIVATE_STATE_PASSWORD is not set in contract/.env');
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (password.length < 16 || classes < 3) {
    throw new Error('PRIVATE_STATE_PASSWORD must be at least 16 characters and use at least 3 character classes');
  }

  setNetworkId(cfg.networkId); // must run before key derivation (bech32m HRP)

  const { seed, kind } = resolveSeed();
  const keys = deriveWalletKeys(seed);
  const unshieldedAddress = unshieldedAddressOf(keys.unshieldedKeystore);

  banner([
    '==========================================================',
    '  MStocks — trading.compact → Midnight',
    '==========================================================',
    `  network      : ${networkName}`,
    `  indexer      : ${cfg.indexer}`,
    `  node         : ${cfg.node}`,
    `  proof server : ${cfg.proofServer}`,
    `  seed type    : ${kind === 'mnemonic' ? 'BIP-39 mnemonic (Lace-compatible derivation)' : 'raw hex seed'}`,
    `  wallet addr  : ${unshieldedAddress}`,
    '==========================================================',
  ]);

  // --- 2. Quick funding gate (fast unshielded-only sync) -------------------
  log('funding check: syncing unshielded wallet (fast)…');
  const unshieldedWallet = await buildUnshieldedWallet(cfg, keys);
  let nightBalance = await unshieldedBalanceOf(unshieldedWallet);
  log(`tNIGHT (unshielded): ${nightBalance}`);

  if (nightBalance === 0n && cfg.faucet !== null) {
    console.error('\n  ✗ This wallet has no tNIGHT on this network.');
    console.error(`    1. Open the faucet: ${cfg.faucet}`);
    console.error(`    2. Fund this address: ${unshieldedAddress}`);
    console.error('    3. The deploy will continue automatically once funds arrive…\n');
    const deadline = Date.now() + FAUCET_WAIT_MS;
    while (Date.now() < deadline && nightBalance === 0n) {
      await sleep(30_000);
      nightBalance = await unshieldedBalanceOf(unshieldedWallet);
      log(`tNIGHT (unshielded): ${nightBalance}`);
    }
    if (nightBalance === 0n) {
      console.error('\n  ✗ Still unfunded after the wait window. Fund the wallet, then re-run: npm run deploy');
      process.exit(2);
    }
  }
  if (nightBalance === 0n && cfg.faucet === null) {
    console.warn('  ! No tNIGHT and no faucet for this network (undeployed devnet?) — continuing anyway.');
  }

  // --- 3. Full wallet facade (shielded + unshielded + dust) ----------------
  await unshieldedWallet.stop().catch(() => undefined); // gate passed; free the socket
  log('building full wallet facade (shielded + unshielded + dust)…');
  const { wallet, restoredFromCache } = await buildFacade(cfg, keys);
  log(restoredFromCache ? 'restored wallet snapshot — delta-syncing…' : 'no snapshot — cold sync (may take a long time on public networks)…');

  let stopping = false;
  const shutdown = async (code: number): Promise<never> => {
    if (stopping) process.exit(code);
    stopping = true;
    log('shutting down: saving wallet snapshot…');
    await saveWalletSnapshot(wallet, cfg.networkId).catch(() => undefined);
    await wallet.stop().catch(() => undefined);
    process.exit(code);
  };
  process.once('SIGINT', () => void shutdown(130));
  process.once('SIGTERM', () => void shutdown(143));

  const stopHeartbeat = startSyncHeartbeat(wallet, { label: 'sync', intervalMs: 60_000 });
  const checkpoint = setInterval(() => {
    void saveWalletSnapshot(wallet, cfg.networkId).catch(() => undefined);
  }, 3 * 60_000);
  checkpoint.unref?.();

  const synced = await waitForSync(wallet, restoredFromCache ? RESTORED_SYNC_TIMEOUT_MS : undefined);
  stopHeartbeat();
  await saveWalletSnapshot(wallet, cfg.networkId);

  const coinPublicKey = synced.shielded.coinPublicKey.toHexString();
  log('✓ wallet synced');
  log(`  coinPublicKey : ${coinPublicKey}`);
  log(`  tNIGHT        : ${unshieldedNightBalance(synced)}`);
  log(`  DUST          : ${dustBalance(synced)}`);

  // --- 4. Ensure DUST for fees ---------------------------------------------
  if (dustBalance(synced) === 0n) {
    log('no DUST yet — registering NIGHT for DUST generation (fees are paid in DUST)…');
    await withTimeout(registerForDustGeneration(wallet, keys.unshieldedKeystore), DUST_TIMEOUT_MS, 'DUST generation');
    const after = await waitForSync(wallet);
    log(`✓ DUST balance: ${dustBalance(after)}`);
  } else {
    log('✓ DUST already available');
  }

  // --- 5. Providers ---------------------------------------------------------
  const zkConfigProvider = new NodeZkConfigProvider(MANAGED_DIR);
  const walletProvider = makeWalletProvider(wallet, keys, synced);
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'trading-private-state',
      midnightDbName: 'mstocks-level-db',
      accountId: coinPublicKey,
      privateStoragePasswordProvider: () => password,
    }),
    publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(cfg.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  // --- 6. Deploy ------------------------------------------------------------
  const compiled = CompiledContract.make(CONTRACT_TAG, TradingContract.Contract).pipe(
    CompiledContract.withWitnesses(createWitnesses() as never),
    CompiledContract.withCompiledFileAssets(MANAGED_DIR) as never,
  );

  log(`deploying "${CONTRACT_TAG}" (proving + submitting — usually 1–3 min)…`);
  const deployed = await deployContract(providers as never, {
    compiledContract: compiled as never,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: emptyTradingPrivateState(),
    args: [],
  } as never);

  // public fields only — deployTxData.private is privacy-sensitive (signing key,
  // initial private state) and must not be serialized.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pub = deployed.deployTxData.public as any;
  const contractAddress: string = pub.contractAddress ?? pub.address;
  const txHash: string | null = pub.txHash ?? pub.txId ?? null;
  if (!contractAddress) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(`Could not read contract address from deployTxData (keys: ${Object.keys(pub).join(', ')})`);
  }
  log('✓ deployed!');
  log(`  contract address : ${contractAddress}`);
  if (txHash) log(`  tx hash          : ${txHash}`);

  // --- 7. Best-effort indexer verification ----------------------------------
  try {
    let state: { data: unknown } | null = null;
    for (let attempt = 0; attempt < 10 && state == null; attempt++) {
      await sleep(6_000);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state = (await (providers.publicDataProvider as any).queryContractState(contractAddress)) ?? null;
      } catch {
        /* indexer may lag; retry */
      }
    }
    if (state == null) {
      log('  (indexer has not indexed the contract yet — this is normal lag; skipping verification)');
    } else {
      const decoded = TradingContract.ledger(state.data as never);
      log(`✓ indexer sees the contract — activeOrderCount = ${decoded.activeOrderCount}`);
    }
  } catch (e) {
    log(`  (contract state verification skipped: ${e instanceof Error ? e.message : String(e)})`);
  }

  // Best-effort: block height of the deploy transaction (recorded in config.ts)
  let blockHeight: number | null = null;
  if (txHash) {
    for (let attempt = 0; attempt < 5 && blockHeight == null; attempt++) {
      blockHeight = await lookupBlockHeight(cfg.indexer, txHash);
      if (blockHeight == null) await sleep(4_000);
    }
    if (blockHeight != null) log(`✓ deploy transaction included in block ${blockHeight}`);
    else log('  (block height not available from the indexer yet — recorded as null)');
  }

  // --- 8. Export artifacts to the frontend ----------------------------------
  const toolchain = (() => {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(MANAGED_DIR, 'compiler', 'contract-info.json'), 'utf8'));
      return {
        compactc: String(info['compiler-version'] ?? '0.31.1'),
        language: String(info['language-version'] ?? '0.23.0'),
        runtime: String(info['runtime-version'] ?? '0.16.0'),
      };
    } catch {
      return { compactc: '0.31.1', language: '0.23.0', runtime: '0.16.0' };
    }
  })();

  const record: DeploymentRecord = {
    network: networkName,
    contractTag: CONTRACT_TAG,
    privateStateId: PRIVATE_STATE_ID,
    contractAddress,
    txHash,
    blockHeight,
    deployedAt: new Date().toISOString(),
    endpoints: {
      indexer: cfg.indexer,
      indexerWS: cfg.indexerWS,
      node: cfg.node,
      proofServer: cfg.proofServer,
    },
    toolchain,
    deployer: {
      coinPublicKey,
      unshieldedAddress,
    },
    circuits: circuitListFrom(),
    faucet: cfg.faucet,
    constants: {
      FAUCET_AMOUNT_CENTS: 100000,
      FAUCET_COOLDOWN_SECS: 604800,
    },
  };

  const { exportDir, files } = exportArtifacts(record);
  log(`✓ exported ${files} artifact files → ${path.relative(process.cwd(), exportDir) || exportDir}`);
  log(`  deployment.json : ${path.join(exportDir, 'deployment.json')}`);
  log(`  config.ts       : ${path.join(exportDir, 'config.ts')}`);

  // --- 9. Done ---------------------------------------------------------------
  await saveWalletSnapshot(wallet, cfg.networkId);
  clearInterval(checkpoint);
  await wallet.stop().catch(() => undefined);

  banner([
    '==========================================================',
    '  ✓ DEPLOYMENT COMPLETE',
    '==========================================================',
    `  network          : ${networkName}`,
    `  contract address : ${contractAddress}`,
    txHash ? `  tx hash          : ${txHash}` : '',
    blockHeight != null ? `  block height     : ${blockHeight}` : '',
    `  artifacts        : ${exportDir}`,
    '==========================================================',
  ].filter((l) => l !== ''));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('\n✗ deploy failed:', e instanceof Error ? (e.stack ?? e.message) : e);
    process.exit(1);
  },
);
