const axios = require('axios');

class AirtableIntegration {
  constructor() {
    this.apiKey = null;
    this.baseId = null;
    this.tableName = null;
    this.baseUrl = null;
  }

  async authenticate(credentials) {
    // credentials: { apiKey, baseId, tableName }
    this.apiKey = credentials.apiKey;
    this.baseId = credentials.baseId;
    this.tableName = credentials.tableName;
    this.baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
  }

  async sendData(data) {
    // Create record in Airtable with provided fields
    const url = `${this.baseUrl}/${encodeURIComponent(this.tableName)}`;
    const response = await axios.post(
      url,
      { fields: data },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  async uploadFile(file, settings = {}) {
    // Store file metadata/content as a record (SMB-friendly fallback)
    // Note: Airtable attachments prefer URLs; this stores base64 for simple workflows.
    const url = `${this.baseUrl}/${encodeURIComponent(this.tableName)}`;
    const record = {
      Name: file.name,
      MimeType: file.mimetype || 'application/octet-stream',
      Size: file.buffer.length,
      Content: file.buffer.toString('base64'),
      ...settings.fields
    };

    const response = await axios.post(
      url,
      { fields: record },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Normalize
    const created = response.data;
    return { id: created?.id || created?.records?.[0]?.id, url: `https://airtable.com/${this.baseId}/${this.tableName}` };
  }
}

module.exports = AirtableIntegration;
