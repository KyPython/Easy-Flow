/**
 * Google Drive Integration for EasyFlow
 * Handles file uploads and data storage to Google Drive
 */

const { google } = require('googleapis');
const { logger } = require('../../utils/logger');

class GoogleDriveIntegration {
 constructor() {
 this.drive = null;
 this.oauth2Client = null;
 }

 /**
 * Authenticate with Google Drive
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

 this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

 logger.info('[GoogleDriveIntegration] Authenticated successfully');
 }

 /**
 * Upload a file to Google Drive
 * @param {Object} params - { file, folderId?, fileName? }
 */
 async uploadFile(params) {
 const { file, folderId, fileName } = params;

 const fileMetadata = {
 name: fileName || file.name || `file_${Date.now()}`,
 ...(folderId && { parents: [folderId] })
 };

 const media = {
 mimeType: file.mimeType || 'application/octet-stream',
 body: file.buffer || file.data || file
 };

 const response = await this.drive.files.create({
 requestBody: fileMetadata,
 media: media,
 fields: 'id, name, webViewLink, webContentLink'
 });

 return {
 success: true,
 fileId: response.data.id,
 fileName: response.data.name,
 webViewLink: response.data.webViewLink,
 webContentLink: response.data.webContentLink
 };
 }

 /**
 * Send data as a JSON file to Google Drive
 * @param {Object} params - { data, folderId?, fileName? }
 */
 async sendData(params) {
 const { data, folderId, fileName } = params;

 const jsonContent = JSON.stringify(data, null, 2);
 const fileNameToUse = fileName || `automation_data_${Date.now()}.json`;

 return await this.uploadFile({
 file: {
 buffer: Buffer.from(jsonContent),
 name: fileNameToUse
 },
 folderId,
 fileName: fileNameToUse
 });
 }

 /**
 * Create a folder in Google Drive
 * @param {Object} params - { folderName, parentFolderId? }
 */
 async createFolder(params) {
 const { folderName, parentFolderId } = params;

 const fileMetadata = {
 name: folderName,
 mimeType: 'application/vnd.google-apps.folder',
 ...(parentFolderId && { parents: [parentFolderId] })
 };

 const response = await this.drive.files.create({
 requestBody: fileMetadata,
 fields: 'id, name, webViewLink'
 });

 return {
 success: true,
 folderId: response.data.id,
 folderName: response.data.name,
 webViewLink: response.data.webViewLink
 };
 }

 /**
 * List files in a folder
 * @param {Object} params - { folderId?, query? }
 */
 async listFiles(params) {
 const { folderId, query } = params;

 let searchQuery = query || '';
 if (folderId) {
 searchQuery = searchQuery
 ? `${searchQuery} and '${folderId}' in parents`
 : `'${folderId}' in parents`;
 }

 const response = await this.drive.files.list({
 q: searchQuery || undefined,
 fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime)',
 pageSize: 100
 });

 return {
 success: true,
 files: response.data.files || []
 };
 }

 /**
 * Delete a file from Google Drive
 * @param {Object} params - { fileId }
 */
 async deleteFile(params) {
 const { fileId } = params;

 await this.drive.files.delete({
 fileId
 });

 return {
 success: true,
 fileId
 };
 }
}

module.exports = GoogleDriveIntegration;

