require('dotenv').config({ path: '../.env' });

// Setup polyfills for Node.js test environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set NODE_ENV for consistent test behavior
process.env.NODE_ENV = 'test';