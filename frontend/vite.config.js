import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
    include: [
      'buffer',
      'object-inspect',
    ],
    needsInterop: [
      'buffer',
      'object-inspect',
    ],
    // Exclude ONLY the raw WebAssembly crates from pre-bundling
    exclude: [
      '@midnight-ntwrk/ledger',
      '@midnight-ntwrk/zswap',
    ],
  },
  commonjsOptions: {
    include: [/buffer/, /object-inspect/, /node_modules/],
    transformMixedEsModules: true,
  },
  server: {
    port: 5173,
    host: true,
  },
});