/**
 * Wallet construction / sync / funds helpers for mstocks (wallet-sdk 1.2.x).
 *
 * Everything here is environment-agnostic Node code shared by deploy.ts and
 * balance.ts. The heavy part is the full WalletFacade sync (shielded + dust
 * ledgers replay via the indexer), which on public networks can take a long
 * time on the first run. To make that survivable, wallet state snapshots are
 * cached under contract/.wallet-state/<network>.json and restored on the next
 * run (delta-sync instead of a fresh cold sync).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import {
  DustWallet,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  ShieldedWallet,
  TransactionHistoryStorage,
  UnshieldedWallet,
  WalletFacade,
  type FacadeState,
} from '@midnightntwrk/wallet-sdk';
import { createKeystore, type UnshieldedKeystore } from '@midnightntwrk/wallet-sdk/unshielded';
import { HDWallet, Roles, validateMnemonic } from '@midnightntwrk/wallet-sdk/hd';
import { mnemonicToSeedSync } from '@scure/bip39';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import type { NetworkConfig } from './networks.js';

// The wallet SDK's indexer client (apollo) wants a global WebSocket.
// @ts-expect-error -- Node lacks a native global WebSocket until v22
globalThis.WebSocket = WebSocket;

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Seed & keys
// ---------------------------------------------------------------------------

export interface SeedInfo {
  readonly seed: string;
  readonly kind: 'mnemonic' | 'hex';
}

/**
 * Resolve the deployer seed from WALLET_SEED: either a 24-word BIP-39
 * mnemonic (derived exactly as Lace does) or a raw 64-hex-character seed.
 */
export function resolveSeed(): SeedInfo {
  const raw = process.env.WALLET_SEED?.trim().replace(/\s+/g, ' ');
  if (!raw || raw.length === 0) {
    throw new Error('WALLET_SEED is not set in contract/.env (24-word mnemonic or 64-hex seed)');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return { seed: raw.toLowerCase(), kind: 'hex' };
  }
  if (!validateMnemonic(raw)) {
    throw new Error('WALLET_SEED is neither a 64-hex seed nor a valid BIP-39 mnemonic (bad word or checksum)');
  }
  return { seed: Buffer.from(mnemonicToSeedSync(raw)).toString('hex'), kind: 'mnemonic' };
}

const deriveKeysFromSeed = (seed: string) => {
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('Failed to initialize HDWallet from seed');
  const result = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Failed to derive wallet keys from seed');
  hd.hdWallet.clear();
  return result.keys;
};

export interface WalletKeys {
  readonly shieldedSecretKeys: ledger.ZswapSecretKeys;
  readonly dustSecretKey: ledger.DustSecretKey;
  readonly unshieldedKeystore: UnshieldedKeystore;
}

/** Derive the three wallet key sets. setNetworkId(...) must already have run. */
export function deriveWalletKeys(seed: string): WalletKeys {
  const keys = deriveKeysFromSeed(seed);
  return {
    shieldedSecretKeys: ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]),
    dustSecretKey: ledger.DustSecretKey.fromSeed(keys[Roles.Dust]),
    unshieldedKeystore: createKeystore(keys[Roles.NightExternal], getNetworkId()),
  };
}

export const unshieldedAddressOf = (keystore: UnshieldedKeystore): string =>
  keystore.getBech32Address().asString();

// ---------------------------------------------------------------------------
// Quick unshielded-only wallet (fast, used to gate on funding)
// ---------------------------------------------------------------------------

export type UnshieldedOnlyWallet = ReturnType<ReturnType<typeof UnshieldedWallet>['startWithPublicKey']>;

/**
 * Build + start ONLY the unshielded wallet. Its sync is served by the node,
 * indexed by public key, so it is fast even on public networks. Used to gate
 * on funding BEFORE committing to the long full-wallet sync.
 */
export async function buildUnshieldedWallet(cfg: NetworkConfig, keys: WalletKeys): Promise<UnshieldedOnlyWallet> {
  const wallet = UnshieldedWallet({
    networkId: cfg.networkId,
    indexerClientConnection: { indexerHttpUrl: cfg.indexer, indexerWsUrl: cfg.indexerWS },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(
      TransactionHistoryStorage.TransactionHistoryCommonSchema,
    ),
  }).startWithPublicKey(PublicKey.fromKeyStore(keys.unshieldedKeystore));
  await wallet.start();
  return wallet;
}

/** NIGHT balance of an unshielded wallet, once it has synced. */
export async function unshieldedBalanceOf(
  wallet: UnshieldedOnlyWallet,
  timeoutMs = 10 * 60_000,
): Promise<bigint> {
  const state = await withTimeout(
    Promise.resolve(wallet.waitForSyncedState()),
    timeoutMs,
    'unshielded wallet sync',
  );
  return state.balances[unshieldedToken().raw] ?? 0n;
}

/** Convenience one-shot: quick funding check. */
export async function quickUnshieldedBalance(cfg: NetworkConfig, keys: WalletKeys): Promise<bigint> {
  const wallet = await buildUnshieldedWallet(cfg, keys);
  const balance = await unshieldedBalanceOf(wallet);
  await wallet.stop().catch(() => undefined);
  return balance;
}

// ---------------------------------------------------------------------------
// Full wallet facade (shielded + unshielded + dust), with state caching
// ---------------------------------------------------------------------------

export interface WalletStateSnapshot {
  readonly shielded: string;
  readonly unshielded: string;
  readonly dust: string;
  readonly savedAt: string;
}

const snapshotPath = (networkId: string): string =>
  path.join(here, '.wallet-state', `${networkId}.json`);

export function loadWalletSnapshot(networkId: string): WalletStateSnapshot | null {
  try {
    const file = snapshotPath(networkId);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as WalletStateSnapshot;
    if (typeof parsed.shielded !== 'string' || typeof parsed.unshielded !== 'string' || typeof parsed.dust !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveWalletSnapshot(wallet: WalletFacade, networkId: string): Promise<void> {
  const snapshot: WalletStateSnapshot = {
    shielded: await wallet.shielded.serializeState(),
    unshielded: await wallet.unshielded.serializeState(),
    dust: await wallet.dust.serializeState(),
    savedAt: new Date().toISOString(),
  };
  const file = snapshotPath(networkId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snapshot), 'utf8');
}

export interface FacadeContext {
  readonly wallet: WalletFacade;
  readonly restoredFromCache: boolean;
}

/**
 * Build and start the full wallet facade (shielded + unshielded + dust).
 * If a cached snapshot exists for this network it is restored (delta-sync);
 * otherwise the wallet cold-syncs (potentially slow on public networks).
 */
export async function buildFacade(cfg: NetworkConfig, keys: WalletKeys): Promise<FacadeContext> {
  setNetworkId(cfg.networkId);

  const configuration = {
    networkId: cfg.networkId,
    indexerClientConnection: { indexerHttpUrl: cfg.indexer, indexerWsUrl: cfg.indexerWS },
    provingServerUrl: new URL(cfg.proofServer),
    relayURL: new URL(cfg.node.replace(/^http/, 'ws')),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(
      TransactionHistoryStorage.TransactionHistoryCommonSchema,
    ),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  const snapshot = loadWalletSnapshot(cfg.networkId);

  const startFacade = async (restore: WalletStateSnapshot | null): Promise<WalletFacade> => {
    const wallet = await WalletFacade.init({
      configuration,
      shielded: (c: unknown) =>
        restore
          ? ShieldedWallet(c as never).restore(restore.shielded)
          : ShieldedWallet(c as never).startWithSecretKeys(keys.shieldedSecretKeys),
      unshielded: (c: unknown) =>
        restore
          ? UnshieldedWallet(c as never).restore(restore.unshielded)
          : UnshieldedWallet(c as never).startWithPublicKey(PublicKey.fromKeyStore(keys.unshieldedKeystore)),
      dust: (c: unknown) =>
        restore
          ? DustWallet(c as never).restore(restore.dust)
          : DustWallet(c as never).startWithSecretKey(
              keys.dustSecretKey,
              ledger.LedgerParameters.initialParameters().dust,
            ),
    });
    await wallet.start(keys.shieldedSecretKeys, keys.dustSecretKey);
    return wallet;
  };

  // Self-heal: a snapshot that fails to restore (incompatible/serialized from a
  // crashed run) is discarded and the wallet cold-syncs instead of failing.
  let wallet: WalletFacade;
  let restoredFromCache = false;
  if (snapshot) {
    try {
      wallet = await startFacade(snapshot);
      restoredFromCache = true;
    } catch (err) {
      console.warn(
        `[wallet-cache] snapshot restore failed (${err instanceof Error ? err.message : String(err)}); ` +
          'discarding snapshot and cold-syncing.',
      );
      wallet = await startFacade(null);
    }
  } else {
    wallet = await startFacade(null);
  }
  return { wallet, restoredFromCache };
}

// ---------------------------------------------------------------------------
// Sync / balance / funds helpers
// ---------------------------------------------------------------------------

export const firstSyncedState = (wallet: WalletFacade): Promise<FacadeState> =>
  Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

export const waitForSync = (wallet: WalletFacade, timeoutMs?: number): Promise<FacadeState> => {
  const synced$ = wallet.state().pipe(
    Rx.throttleTime(2_000),
    Rx.filter((s) => s.isSynced),
  );
  return Rx.firstValueFrom(
    timeoutMs === undefined ? synced$ : synced$.pipe(Rx.timeout({ first: timeoutMs })),
  );
};

export const unshieldedNightBalance = (s: FacadeState): bigint =>
  s.unshielded.balances[unshieldedToken().raw] ?? 0n;

export const dustBalance = (s: FacadeState): bigint => {
  try {
    return s.dust.balance(new Date());
  } catch {
    return 0n;
  }
};

const pickBigint = (obj: unknown, keys: readonly string[]): bigint | null => {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'bigint') return v;
  }
  return null;
};

const fmtProgress = (progress: unknown): string => {
  const applied = pickBigint(progress, ['appliedId', 'appliedIndex', 'highestRelevantWalletIndex']) ?? '?';
  const highest = pickBigint(progress, ['highestTransactionId', 'highestIndex', 'highestRelevantIndex']) ?? '?';
  return `${applied}/${highest}`;
};

const describeState = (s: FacadeState | null): string => {
  if (s === null) return 'waiting for first wallet state…';
  let detail = 'progress unavailable';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyState = s as any;
    detail = `shielded ${fmtProgress(anyState.shielded?.progress)} · unshielded ${fmtProgress(
      anyState.unshielded?.progress,
    )} · dust ${fmtProgress(anyState.dust?.progress)}`;
  } catch {
    /* keep fallback */
  }
  return `${detail} (synced=${s.isSynced})`;
};

/**
 * Log sync progress on an interval while the wallet syncs; returns a stop()
 * function. Keeps long cold syncs observable instead of silent.
 */
export const startSyncHeartbeat = (
  wallet: WalletFacade,
  opts: { readonly intervalMs?: number; readonly label?: string } = {},
): (() => void) => {
  const intervalMs = opts.intervalMs ?? 60_000;
  const prefix = `[${opts.label ?? 'sync'}]`;
  let latest: FacadeState | null = null;
  const started = Date.now();
  const sub = wallet.state().subscribe({ next: (s) => (latest = s) });
  const timer = setInterval(() => {
    console.log(`${prefix} +${Math.round((Date.now() - started) / 1000)}s ${describeState(latest)}`);
  }, intervalMs);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    sub.unsubscribe();
  };
};

/**
 * Wait until the wallet has a positive unshielded NIGHT balance (used after
 * printing faucet instructions). Rejects on timeout.
 */
export const waitForFunds = (wallet: WalletFacade, timeoutMs?: number): Promise<bigint> => {
  const funds$ = wallet.state().pipe(
    Rx.throttleTime(5_000),
    Rx.filter((s) => s.isSynced),
    Rx.map(unshieldedNightBalance),
    Rx.filter((b) => b > 0n),
  );
  return Rx.firstValueFrom(
    timeoutMs === undefined ? funds$ : funds$.pipe(Rx.timeout({ first: timeoutMs })),
  );
};

/**
 * If the wallet holds unregistered NIGHT UTXOs, submit a registration
 * transaction so they start generating DUST (Midnight fees are paid in DUST),
 * then wait until the DUST balance is positive.
 */
export async function registerForDustGeneration(
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> {
  const state = await firstSyncedState(wallet);
  if (state.dust.availableCoins.length > 0 && dustBalance(state) > 0n) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nightUtxos = state.unshielded.availableCoins.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coin: any) => coin?.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) return;

  console.log(`[dust] registering ${nightUtxos.length} NIGHT UTXO(s) for DUST generation…`);
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    nightUtxos,
    unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => unshieldedKeystore.signData(payload),
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);

  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(2_000),
      Rx.filter((s) => s.isSynced),
      Rx.filter((s) => dustBalance(s) > 0n),
    ),
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)}s`)), ms);
    timer.unref?.();
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
