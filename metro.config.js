const http = require('http');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files bundled into the app.
config.resolver.sourceExts.push('sql');

// Web only: expo-sqlite runs SQLite as WebAssembly in the browser.
config.resolver.assetExts.push('wasm');

// Web preview in development only. The synchronous database API needs
// SharedArrayBuffer, which browsers allow only when the page AND its scripts are
// served with the two headers below. Expo's dev server serves the HTML page outside
// Metro's middleware and offers no hook for it, so the headers are added to every
// response of this dev-server process. Android and iOS builds are not affected.
const sendHeaders = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function writeHead(...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return sendHeaders.apply(this, args);
};

module.exports = config;
