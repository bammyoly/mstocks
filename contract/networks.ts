/**
 * Midnight network configuration for mstocks.
 *
 * Endpoints can be overridden through environment variables (contract/.env):
 *   MN_NODE_URL, MN_INDEXER_URL, MN_INDEXER_WS (or MN_INDEXER_WS_URL),
 *   MN_PROOF_SERVER_URL
 */

export type NetworkName = 'preview' | 'preprod' | 'undeployed';

export interface NetworkConfig {
  /** Midnight network id (also the bech32m address prefix, e.g. mn_addr_preview1…) */
  readonly networkId: NetworkName;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly faucet: string | null;
}

const DEFAULTS: Record<NetworkName, NetworkConfig> = {
  preview: {
    networkId: 'preview',
    indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    // Midnight's hosted proof server for Preview. To prove fully locally, run
    //   docker run -p 6300:6300 midnightnetwork/proof-server
    // and set MN_PROOF_SERVER_URL=http://localhost:6300 in contract/.env.
    proofServer: 'https://proof-server.preview.midnight.network',
    faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
  },
  preprod: {
    networkId: 'preprod',
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: 'https://proof-server.preprod.midnight.network',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  },
  undeployed: {
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node: 'http://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
    faucet: null,
  },
};

/** Read an env override; blank/whitespace counts as unset. */
const env = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value !== undefined && value.length > 0 ? value : undefined;
};

export const NETWORK_NAMES = Object.keys(DEFAULTS) as NetworkName[];

export function resolveNetwork(): { name: NetworkName; config: NetworkConfig } {
  const raw = (process.env.NETWORK ?? 'preview').trim().toLowerCase();
  if (!NETWORK_NAMES.includes(raw as NetworkName)) {
    throw new Error(`Invalid NETWORK "${raw}" — expected one of: ${NETWORK_NAMES.join(', ')}`);
  }
  const name = raw as NetworkName;
  const base = DEFAULTS[name];
  return {
    name,
    config: {
      ...base,
      node: env('MN_NODE_URL') ?? base.node,
      indexer: env('MN_INDEXER_URL') ?? base.indexer,
      indexerWS: env('MN_INDEXER_WS') ?? env('MN_INDEXER_WS_URL') ?? base.indexerWS,
      proofServer: env('MN_PROOF_SERVER_URL') ?? base.proofServer,
    },
  };
}
