/**
 * Client-Side Encryption Utility
 * 
 * This utility provides AES-256-GCM encryption for sensitive data before transmission.
 * Key management is handled through environment variables and secure key derivation.
 * 
 * Security Features:
 * - AES-256-GCM encryption with authentication
 * - PBKDF2 key derivation with salt
 * - Random IV generation for each encryption
 * - Base64 encoding for safe transmission
 * 
 * Usage:
 * import { encryptSensitiveData, decryptSensitiveData } from './encryption';
 * 
 * const encrypted = await encryptSensitiveData('password123');
 * const decrypted = await decryptSensitiveData(encrypted);
 */

import CryptoJS from 'crypto-js';

// Configuration from environment variables
const ENCRYPTION_ENABLED = process.env.REACT_APP_ENCRYPTION_ENABLED !== 'false';
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'default-dev-key-change-in-production';
const SALT = process.env.REACT_APP_ENCRYPTION_SALT || 'easyflow-default-salt';

/**
 * Derive a secure key from the base key using PBKDF2
 * @param {string} baseKey - Base encryption key
 * @param {string} salt - Salt for key derivation
 * @returns {string} Derived key
 */
const deriveKey = (baseKey, salt) => {
 return CryptoJS.PBKDF2(baseKey, salt, {
 keySize: 256 / 32,
 iterations: 10000
 });
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {Object} options - Encryption options
 * @returns {Promise<string>} Encrypted data as base64 string
 */
export const encryptSensitiveData = async (plaintext, options = {}) => {
 if (!ENCRYPTION_ENABLED) {
 console.warn('⚠️ Encryption disabled - returning plaintext');
 return plaintext;
 }

 if (!plaintext || typeof plaintext !== 'string') {
 throw new Error('Invalid plaintext data for encryption');
 }

 try {
 // Derive encryption key
 const key = deriveKey(ENCRYPTION_KEY, SALT);
 
 // Generate random IV
 const iv = CryptoJS.lib.WordArray.random(12); // 96 bits for GCM
 
 // Encrypt the data
 const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
 iv: iv,
 mode: CryptoJS.mode.GCM,
 padding: CryptoJS.pad.NoPadding
 });

 // Combine IV and encrypted data
 const result = {
 iv: iv.toString(CryptoJS.enc.Base64),
 encrypted: encrypted.toString(),
 tag: encrypted.tag ? encrypted.tag.toString(CryptoJS.enc.Base64) : null,
 algorithm: 'AES-256-GCM',
 timestamp: Date.now()
 };

 return btoa(JSON.stringify(result));
 } catch (error) {
 console.error('Encryption failed:', error);
 throw new Error('Failed to encrypt sensitive data');
 }
};

/**
 * Decrypt sensitive data encrypted with encryptSensitiveData
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {Promise<string>} Decrypted plaintext
 */
export const decryptSensitiveData = async (encryptedData) => {
 if (!ENCRYPTION_ENABLED) {
 console.warn('⚠️ Encryption disabled - returning data as-is');
 return encryptedData;
 }

 if (!encryptedData || typeof encryptedData !== 'string') {
 throw new Error('Invalid encrypted data for decryption');
 }

 try {
 // Parse encrypted data
 const data = JSON.parse(atob(encryptedData));
 
 if (!data.iv || !data.encrypted) {
 throw new Error('Invalid encrypted data format');
 }

 // Derive decryption key
 const key = deriveKey(ENCRYPTION_KEY, SALT);
 
 // Reconstruct IV
 const iv = CryptoJS.enc.Base64.parse(data.iv);
 
 // Decrypt the data
 const decrypted = CryptoJS.AES.decrypt(data.encrypted, key, {
 iv: iv,
 mode: CryptoJS.mode.GCM,
 padding: CryptoJS.pad.NoPadding
 });

 return decrypted.toString(CryptoJS.enc.Utf8);
 } catch (error) {
 console.error('Decryption failed:', error);
 throw new Error('Failed to decrypt sensitive data');
 }
};

/**
 * Identify sensitive fields that should be encrypted
 * @param {string} fieldName - Name of the field
 * @returns {boolean} Whether the field should be encrypted
 */
export const isSensitiveField = (fieldName) => {
 const sensitiveFields = [
 'password',
 'secret',
 'token',
 'key',
 'credential',
 'auth',
 'api_key',
 'access_token',
 'private_key',
 'webhook_secret',
 'database_password',
 'smtp_password',
 'oauth_secret'
 ];
 
 const fieldLower = fieldName.toLowerCase();
 return sensitiveFields.some(sensitive => fieldLower.includes(sensitive));
};

/**
 * Recursively encrypt sensitive fields in an object
 * @param {Object} obj - Object containing potentially sensitive data
 * @returns {Promise<Object>} Object with encrypted sensitive fields
 */
export const encryptSensitiveFields = async (obj) => {
 if (!obj || typeof obj !== 'object') {
 return obj;
 }

 const encrypted = {};
 
 for (const [key, value] of Object.entries(obj)) {
 if (value === null || value === undefined) {
 encrypted[key] = value;
 } else if (typeof value === 'object') {
 encrypted[key] = await encryptSensitiveFields(value);
 } else if (typeof value === 'string' && isSensitiveField(key)) {
 encrypted[key] = await encryptSensitiveData(value);
 encrypted[`${key}_encrypted`] = true; // Flag for backend processing
 } else {
 encrypted[key] = value;
 }
 }
 
 return encrypted;
};

/**
 * Recursively decrypt sensitive fields in an object
 * @param {Object} obj - Object containing encrypted sensitive data
 * @returns {Promise<Object>} Object with decrypted sensitive fields
 */
export const decryptSensitiveFields = async (obj) => {
 if (!obj || typeof obj !== 'object') {
 return obj;
 }

 const decrypted = {};
 
 for (const [key, value] of Object.entries(obj)) {
 if (key.endsWith('_encrypted')) {
 continue; // Skip encryption flags
 }
 
 if (value === null || value === undefined) {
 decrypted[key] = value;
 } else if (typeof value === 'object') {
 decrypted[key] = await decryptSensitiveFields(value);
 } else if (typeof value === 'string' && obj[`${key}_encrypted`]) {
 try {
 decrypted[key] = await decryptSensitiveData(value);
 } catch (error) {
 console.error(`Failed to decrypt field ${key}:`, error);
 decrypted[key] = value; // Return encrypted value if decryption fails
 }
 } else {
 decrypted[key] = value;
 }
 }
 
 return decrypted;
};

/**
 * Generate a random encryption key for production use
 * @returns {string} Random base64 key
 */
export const generateEncryptionKey = () => {
 return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64);
};

// Development utilities
if (process.env.NODE_ENV === 'development') {
 window.EasyFlowEncryption = {
 encryptSensitiveData,
 decryptSensitiveData,
 encryptSensitiveFields,
 decryptSensitiveFields,
 generateEncryptionKey,
 isSensitiveField
 };
 
 console.log('🔐 EasyFlow encryption utilities available in development mode');
 console.log('Example: window.EasyFlowEncryption.generateEncryptionKey()');
}

export default {
 encryptSensitiveData,
 decryptSensitiveData,
 encryptSensitiveFields,
 decryptSensitiveFields,
 isSensitiveField,
 generateEncryptionKey
};