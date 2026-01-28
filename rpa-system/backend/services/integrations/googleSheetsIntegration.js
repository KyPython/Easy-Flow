/**
 * Google Sheets Integration for EasyFlow
 * Handles reading and writing data to Google Sheets
 */

const { google } = require('googleapis');
const { logger } = require('../../utils/logger');

class GoogleSheetsIntegration {
 constructor() {
 this.sheets = null;
 this.oauth2Client = null;
 }

 /**
 * Authenticate with Google Sheets
 * @param {Object} credentials - { accessToken, refreshToken, clientId, clientSecret }
 */
 async authenticate(credentials) {
 const { accessToken, refreshToken, clientId, clientSecret } = credentials;

 this.oauth2Client = new google.auth.OAuth2(
 clientId,
 clientSecret,
 'urn:ietf:wg:oauth:2.0:oob'
 );

 this.oauth2Client.setCredentials({
 access_token: accessToken,
 refresh_token: refreshToken
 });

 // Refresh token if needed
 if (!accessToken && refreshToken) {
 const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
 this.oauth2Client.setCredentials(newCredentials);
 }

 this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });

 logger.info('[GoogleSheetsIntegration] Authenticated successfully');
 }

 /**
 * Read data from a Google Sheet
 * @param {Object} params - { spreadsheetId, range, sheetName? }
 */
 async readData(params) {
 const { spreadsheetId, range, sheetName = null } = params;

 // Build range: "Sheet1!A1:C10" or just "A1:C10"
 const fullRange = sheetName ? `${sheetName}!${range}` : range;

 const response = await this.sheets.spreadsheets.values.get({
 spreadsheetId,
 range: fullRange
 });

 return {
 success: true,
 data: response.data.values || [],
 range: response.data.range,
 majorDimension: response.data.majorDimension
 };
 }

 /**
 * Write data to a Google Sheet
 * @param {Object} params - { spreadsheetId, range, values, sheetName? }
 */
 async writeData(params) {
 const { spreadsheetId, range, values, sheetName = null } = params;

 // Build range
 const fullRange = sheetName ? `${sheetName}!${range}` : range;

 const response = await this.sheets.spreadsheets.values.update({
 spreadsheetId,
 range: fullRange,
 valueInputOption: 'USER_ENTERED',
 requestBody: {
 values: Array.isArray(values[0]) ? values : [values]
 }
 });

 return {
 success: true,
 updatedCells: response.data.updatedCells,
 updatedRange: response.data.updatedRange
 };
 }

 /**
 * Append data to a Google Sheet
 * @param {Object} params - { spreadsheetId, values, sheetName? }
 */
 async appendData(params) {
 const { spreadsheetId, values, sheetName = null } = params;

 const range = sheetName || 'Sheet1';

 const response = await this.sheets.spreadsheets.values.append({
 spreadsheetId,
 range,
 valueInputOption: 'USER_ENTERED',
 insertDataOption: 'INSERT_ROWS',
 requestBody: {
 values: Array.isArray(values[0]) ? values : [values]
 }
 });

 return {
 success: true,
 updatedCells: response.data.updates?.updatedCells,
 updatedRange: response.data.updates?.updatedRange
 };
 }

 /**
 * Compile feedback from multiple sources into a sheet
 * @param {Object} params - { spreadsheetId, feedback, sheetName? }
 */
 async compileFeedback(params) {
 const { spreadsheetId, feedback, sheetName = 'Feedback' } = params;

 // Ensure sheet exists
 await this._ensureSheet(spreadsheetId, sheetName);

 // Prepare data
 const headers = ['Source', 'Timestamp', 'From', 'Subject/Channel', 'Feedback', 'Sentiment'];
 const rows = feedback.map(item => [
 item.source || 'Unknown',
 item.timestamp || new Date().toISOString(),
 item.from || item.user || 'Unknown',
 item.subject || item.channel || 'N/A',
 item.text || item.body || item.message || '',
 this._detectSentiment(item.text || item.body || item.message || '')
 ]);

 // Check if headers exist
 const existingData = await this.readData({
 spreadsheetId,
 range: `${sheetName}!A1:F1`
 });

 let startRow = 1;
 if (existingData.data.length === 0 || existingData.data[0][0] !== 'Source') {
 // Write headers
 await this.writeData({
 spreadsheetId,
 range: `${sheetName}!A1`,
 values: [headers]
 });
 startRow = 2;
 } else {
 // Find next empty row
 const allData = await this.readData({
 spreadsheetId,
 range: `${sheetName}!A:F`
 });
 startRow = allData.data.length + 1;
 }

 // Append feedback rows
 if (rows.length > 0) {
 await this.appendData({
 spreadsheetId,
 values: rows,
 sheetName
 });
 }

 return {
 success: true,
 rowsAdded: rows.length,
 startRow,
 sheetName
 };
 }

 /**
 * Ensure a sheet exists in the spreadsheet
 * @private
 */
 async _ensureSheet(spreadsheetId, sheetName) {
 try {
 const spreadsheet = await this.sheets.spreadsheets.get({
 spreadsheetId
 });

 const sheetExists = spreadsheet.data.sheets?.some(
 sheet => sheet.properties.title === sheetName
 );

 if (!sheetExists) {
 await this.sheets.spreadsheets.batchUpdate({
 spreadsheetId,
 requestBody: {
 requests: [{
 addSheet: {
 properties: {
 title: sheetName
 }
 }
 }]
 }
 });
 }
 } catch (error) {
 logger.error('[GoogleSheetsIntegration] Error ensuring sheet exists:', error);
 throw error;
 }
 }

 /**
 * Detect sentiment from text (simple keyword-based)
 * @private
 */
 _detectSentiment(text) {
 const lowerText = text.toLowerCase();
 const positiveWords = ['love', 'great', 'excellent', 'amazing', 'good', 'happy', 'satisfied'];
 const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'disappointed', 'frustrated', 'angry'];

 const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
 const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

 if (positiveCount > negativeCount) return 'Positive';
 if (negativeCount > positiveCount) return 'Negative';
 return 'Neutral';
 }
}

module.exports = GoogleSheetsIntegration;

