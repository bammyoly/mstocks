/**
 * MStocks — wallet status check.
 *
 * Usage (from the project root):
 *   npm run balance           quick check: address + unshielded tNIGHT balance
 *   npm run balance -- --full full check: syncs shielded + dust wallets too
 *                              (may be slow on public networks on first run)
 */
import './load-env.js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { resolveNetwork } from './networks.js';
import {
  buildFacade,
  buildUnshieldedWallet,
  deriveWalletKeys,
  dustBalance,
  resolveSeed,
  saveWalletSnapshot,
  startSyncHeartbeat,
  unshieldedAddressOf,
  unshieldedBalanceOf,
  unshieldedNightBalance,
  waitForSync,
} from './wallet.js';

const full = process.argv.includes('--full');

const { name: networkName, config: cfg } = resolveNetwork();
setNetworkId(cfg.networkId);

const { seed, kind } = resolveSeed();
const keys = deriveWalletKeys(seed);
const address = unshieldedAddressOf(keys.unshieldedKeystore);

console.log(`network      : ${networkName}`);
console.log(`wallet type  : ${kind}`);
console.log(`address      : ${address}`);
if (cfg.faucet) console.log(`faucet       : ${cfg.faucet}`);

const unshieldedWallet = await buildUnshieldedWallet(cfg, keys);
const night = await unshieldedBalanceOf(unshieldedWallet);
console.log(`tNIGHT       : ${night}`);

if (!full) {
  console.log(night === 0n && cfg.faucet ? '\nWallet is EMPTY — fund it at the faucet, then run: npm run deploy' : '\nWallet is funded — ready to deploy (npm run deploy).');
  await unshieldedWallet.stop().catch(() => undefined);
  process.exit(night === 0n ? 2 : 0);
}

await unshieldedWallet.stop().catch(() => undefined);

console.log('\nfull sync (shielded + dust)…');
const { wallet, restoredFromCache } = await buildFacade(cfg, keys);
const stopHeartbeat = startSyncHeartbeat(wallet, { label: 'sync', intervalMs: 60_000 });
const synced = await waitForSync(wallet);
stopHeartbeat();
await saveWalletSnapshot(wallet, cfg.networkId);

console.log(`synced       : ${synced.isSynced}`);
console.log(`coin pubkey  : ${synced.shielded.coinPublicKey.toHexString()}`);
console.log(`tNIGHT       : ${unshieldedNightBalance(synced)}`);
console.log(`DUST         : ${dustBalance(synced)}`);
await wallet.stop().catch(() => undefined);
process.exit(0);
