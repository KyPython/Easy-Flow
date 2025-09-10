// Jest setup file for polyfills and global configurations
const { TextEncoder, TextDecoder } = require('util');

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock crypto if needed
if (typeof global.crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}

// Set up fetch polyfill if needed
if (typeof global.fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Suppress console warnings during tests
const originalConsoleWarn = console.warn;
console.warn = (message, ...args) => {
  // Suppress specific React warnings that are not relevant for tests
  if (typeof message === 'string' && message.includes('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  originalConsoleWarn.call(console, message, ...args);
};