/**
 * Google Calendar Integration for EasyFlow
 * Handles reading events, creating meetings, and managing schedules
 */

const { google } = require('googleapis');
const { logger } = require('../../utils/logger');

class GoogleCalendarIntegration {
  constructor() {
    this.calendar = null;
    this.oauth2Client = null;
  }

  /**
   * Authenticate with Google Calendar
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
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    // Verify authentication
    try {
      const calendarList = await this.calendar.calendarList.list({ maxResults: 1 });
      logger.info('[GoogleCalendarIntegration] Authenticated successfully', {
        calendarsFound: calendarList.data.items?.length || 0
      });
    } catch (error) {
      // Check for specific API not enabled error
      if (error.message.includes('API has not been used in project') || error.message.includes('it is disabled')) {
        const projectIdMatch = error.message.match(/project (\d+)/);
        const projectId = projectIdMatch ? projectIdMatch[1] : 'YOUR_PROJECT_ID';
        throw new Error(`Google Calendar API has not been used in project ${projectId} or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=${projectId} then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.`);
      }
      throw new Error(`Google Calendar authentication failed: ${error.message}`);
    }
  }

  /**
   * List events from a calendar
   * @param {Object} params - { calendarId?, timeMin?, timeMax?, maxResults? }
   */
  async listEvents(params = {}) {
    const { calendarId = 'primary', timeMin, timeMax, maxResults = 10 } = params;
    
    const response = await this.calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    return response.data.items || [];
  }

  /**
   * Create a new event
   * @param {Object} params - { summary, description?, start, end, attendees?, location? }
   */
  async createEvent(params) {
    const { summary, description, start, end, attendees, location } = params;
    
    const event = {
      summary,
      description,
      location,
      start: {
        dateTime: start,
        timeZone: 'UTC'
      },
      end: {
        dateTime: end,
        timeZone: 'UTC'
      }
    };
    
    if (attendees && attendees.length > 0) {
      event.attendees = attendees.map(email => ({ email }));
    }
    
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });
    
    return response.data;
  }

  /**
   * Get a specific event
   * @param {Object} params - { eventId, calendarId? }
   */
  async getEvent(params) {
    const { eventId, calendarId = 'primary' } = params;
    
    const response = await this.calendar.events.get({
      calendarId,
      eventId
    });
    
    return response.data;
  }

  /**
   * Update an event
   * @param {Object} params - { eventId, calendarId?, updates }
   */
  async updateEvent(params) {
    const { eventId, calendarId = 'primary', updates } = params;
    
    // First get the existing event
    const existingEvent = await this.getEvent({ eventId, calendarId });
    
    // Merge updates
    const updatedEvent = {
      ...existingEvent,
      ...updates
    };
    
    const response = await this.calendar.events.update({
      calendarId,
      eventId,
      resource: updatedEvent
    });
    
    return response.data;
  }

  /**
   * Delete an event
   * @param {Object} params - { eventId, calendarId? }
   */
  async deleteEvent(params) {
    const { eventId, calendarId = 'primary' } = params;
    
    await this.calendar.events.delete({
      calendarId,
      eventId
    });
    
    return { success: true };
  }

  /**
   * List available calendars
   */
  async listCalendars() {
    const response = await this.calendar.calendarList.list();
    return response.data.items || [];
  }

  /**
   * Send data to calendar (create event)
   * @param {Object} data - Event data
   * @param {Object} settings - Additional settings
   */
  async sendData(data, settings = {}) {
    return this.createEvent({
      summary: data.summary || data.title,
      description: data.description,
      start: data.start || settings.start,
      end: data.end || settings.end,
      attendees: data.attendees || settings.attendees,
      location: data.location || settings.location
    });
  }
}

module.exports = GoogleCalendarIntegration;

