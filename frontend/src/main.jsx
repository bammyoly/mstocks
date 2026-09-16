import { Buffer } from 'buffer';

// Inject Node.js globals required by Web3 / Midnight packages
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  window.global = window.global || window;
  if (typeof window.exports === 'undefined') {
    window.exports = {};
  }
  if (typeof window.module === 'undefined') {
    window.module = { exports: window.exports };
  }
}

// 2. Global BigInt JSON Serializer Polyfill (Fixes JSON.stringify for BigInt)
if (typeof BigInt.prototype.toJSON !== 'function') {
  BigInt.prototype.toJSON = function () {
    return { __type: 'bigint', value: this.toString() };
  };
}


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter} from 'react-router-dom'
import { WalletProvider } from './context/WalletContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
)
