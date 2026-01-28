/**
 * Environment-Aware Console Wrapper
 * 
 * Wraps console methods to automatically make them environment-aware.
 * In production, suppresses DEBUG/INFO logs and shows only user-friendly messages.
 * In development, shows all technical details.
 * 
 * Usage:
 * import { console } from './utils/consoleWrapper';
 * console.log('Technical details', { data }); // Only shows in dev
 * console.error('User-friendly error'); // Shows in both, but formatted for env
 */

import { isDevelopment, getEnvLogMessage } from './envAwareMessages';

const isDev = isDevelopment();

/**
 * Wrapped console that automatically handles environment awareness
 */
export const console = {
 /**
 * Debug logs - only in development
 */
 debug: (...args) => {
 if (isDev) {
 console.debug(...args);
 }
 },

 /**
 * Info logs - environment-aware
 */
 log: (...args) => {
 const message = getEnvLogMessage(args[0], args[0]);
 if (message !== null) {
 if (isDev) {
 console.log(...args);
 } else {
 // In production, only log if it's a user-friendly message
 console.log(message);
 }
 }
 },

 /**
 * Info logs - same as log but more explicit
 */
 info: (...args) => {
 const message = getEnvLogMessage(args[0], args[0]);
 if (message !== null) {
 if (isDev) {
 console.info(...args);
 } else {
 console.info(message);
 }
 }
 },

 /**
 * Warning logs - always shown, but formatted for environment
 */
 warn: (...args) => {
 if (isDev) {
 console.warn(...args);
 } else {
 // In production, show user-friendly version
 const userFriendly = typeof args[0] === 'string' 
 ? args[0].replace(/\[.*?\]/g, '').trim() // Remove technical prefixes
 : args[0];
 console.warn(userFriendly);
 }
 },

 /**
 * Error logs - always shown, but formatted for environment
 */
 error: (...args) => {
 if (isDev) {
 console.error(...args);
 } else {
 // In production, show user-friendly version
 const userFriendly = typeof args[0] === 'string' 
 ? args[0].replace(/\[.*?\]/g, '').trim() // Remove technical prefixes
 : args[0];
 console.error(userFriendly);
 }
 },
};

export default console;

