/**
 * Google Meet Integration for EasyFlow
 * Handles downloading recordings and transcribing them
 */

const { google } = require('googleapis');
const { logger } = require('../../utils/logger');
const TranscriptionService = require('./transcriptionService');

class GoogleMeetIntegration {
  constructor() {
    this.drive = null;
    this.calendar = null;
    this.oauth2Client = null;
    this.transcriptionService = new TranscriptionService();
  }

  /**
   * Authenticate with Google (Drive + Calendar for Meet recordings)
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
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    logger.info('[GoogleMeetIntegration] Authenticated successfully');
  }

  /**
   * Find Meet recordings in Google Drive
   * @param {Object} params - { since?, maxResults? }
   */
  async findRecordings(params = {}) {
    const { since = null, maxResults = 10 } = params;

    let query = "mimeType='video/mp4' and name contains 'Meet Recording'";

    if (since) {
      const sinceDate = new Date(since).toISOString();
      query += ` and modifiedTime >= '${sinceDate}'`;
    }

    const response = await this.drive.files.list({
      q: query,
      orderBy: 'modifiedTime desc',
      pageSize: maxResults,
      fields: 'files(id, name, createdTime, modifiedTime, size, webViewLink)'
    });

    return {
      success: true,
      recordings: response.data.files || [],
      count: response.data.files?.length || 0
    };
  }

  /**
   * Download a Meet recording from Google Drive
   * @param {String} fileId - Google Drive file ID
   */
  async downloadRecording(fileId) {
    const fileMetadata = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size'
    });

    const fileResponse = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return {
      success: true,
      file: {
        id: fileId,
        name: fileMetadata.data.name,
        buffer: Buffer.from(fileResponse.data),
        mimetype: fileMetadata.data.mimeType,
        size: fileMetadata.data.size
      }
    };
  }

  /**
   * Transcribe a Meet recording
   * @param {String} fileId - Google Drive file ID
   * @param {Object} options - Transcription options
   */
  async transcribeRecording(fileId, options = {}) {
    // Download recording
    const downloadResult = await this.downloadRecording(fileId);
    const file = downloadResult.file;

    // Transcribe
    const transcription = await this.transcriptionService.transcribe(file, options);

    return {
      success: true,
      fileId,
      fileName: file.name,
      transcription: transcription.text,
      language: transcription.language,
      duration: transcription.duration
    };
  }

  /**
   * Get Meet events from Calendar
   * @param {Object} params - { calendarId?, timeMin?, timeMax?, maxResults? }
   */
  async getMeetEvents(params = {}) {
    const {
      calendarId = 'primary',
      timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax = new Date().toISOString(),
      maxResults = 10
    } = params;

    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
      q: 'meet' // Filter for events with Meet links
    });

    const meetEvents = (response.data.items || []).filter(event => {
      // Check if event has Meet link
      return event.hangoutLink ||
             event.conferenceData?.entryPoints?.some(ep => ep.entryPointType === 'video');
    });

    return {
      success: true,
      events: meetEvents.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri,
        attendees: event.attendees?.map(a => ({ email: a.email, responseStatus: a.responseStatus })) || []
      })),
      count: meetEvents.length
    };
  }

  /**
   * Process all recent Meet recordings and transcribe them
   * @param {Object} params - { since?, extractInsights? }
   */
  async processRecordings(params = {}) {
    const { since = null, extractInsights = false } = params;

    // Find recordings
    const recordingsResult = await this.findRecordings({ since });

    // Process each recording
    const results = await Promise.all(
      recordingsResult.recordings.map(async (recording) => {
        try {
          const transcription = await this.transcribeRecording(recording.id);

          let insights = null;
          if (extractInsights) {
            insights = await this.transcriptionService.extractInsights(transcription.transcription, {
              focus: 'customer feedback and product insights'
            });
          }

          return {
            success: true,
            recording: {
              id: recording.id,
              name: recording.name,
              createdTime: recording.createdTime
            },
            transcription: transcription.transcription,
            language: transcription.language,
            insights: insights?.insights || null
          };
        } catch (error) {
          logger.error(`[GoogleMeetIntegration] Failed to process recording ${recording.id}:`, error);
          return {
            success: false,
            recording: {
              id: recording.id,
              name: recording.name
            },
            error: error.message
          };
        }
      })
    );

    return {
      success: true,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

module.exports = GoogleMeetIntegration;

