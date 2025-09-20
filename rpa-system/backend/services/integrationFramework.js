const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

/**
 * Integration Framework for EasyFlow
 * Connects to external services like accounting software, CRMs, cloud storage
 */
class IntegrationFramework {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
    
    this.integrations = {
      quickbooks: new QuickBooksIntegration(),
      dropbox: new DropboxIntegration(),
      googleDrive: new GoogleDriveIntegration(),
      salesforce: new SalesforceIntegration(),
      slack: new SlackIntegration(),
      zapier: new ZapierIntegration()
    };
  }

  /**
   * Upload files to external services after automation
   */
  async uploadToExternalService(files, integrationConfig) {
    const { service, credentials, settings } = integrationConfig;
    
    try {
      const integration = this.integrations[service];
      if (!integration) {
        throw new Error(`Integration ${service} not supported`);
      }

      await integration.authenticate(credentials);
      
      const results = [];
      for (const file of files) {
        try {
          const uploadResult = await integration.uploadFile(file, settings);
          results.push({
            file: file.name,
            success: true,
            externalId: uploadResult.id,
            url: uploadResult.url
          });
        } catch (error) {
          results.push({
            file: file.name,
            success: false,
            error: error.message
          });
        }
      }

      return results;
      
    } catch (error) {
      console.error('[IntegrationFramework] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Send data to external systems (CRM, accounting, etc.)
   */
  async sendDataToExternalSystem(data, integrationConfig) {
    const { service, credentials, mapping } = integrationConfig;
    
    try {
      const integration = this.integrations[service];
      if (!integration) {
        throw new Error(`Integration ${service} not supported`);
      }

      await integration.authenticate(credentials);
      
      // Transform data according to mapping rules
      const transformedData = this.transformData(data, mapping);
      
      const result = await integration.sendData(transformedData);
      
      return {
        success: true,
        externalId: result.id,
        message: `Data sent to ${service} successfully`
      };
      
    } catch (error) {
      console.error('[IntegrationFramework] Data send failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transform extracted data to match external system format
   */
  transformData(data, mapping) {
    const transformed = {};
    
    for (const [sourceField, targetField] of Object.entries(mapping)) {
      const value = this.getNestedValue(data, sourceField);
      if (value !== undefined) {
        this.setNestedValue(transformed, targetField, value);
      }
    }
    
    return transformed;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * QuickBooks Integration
 */
class QuickBooksIntegration {
  constructor() {
    this.baseUrl = 'https://api.quickbooks.com/v3/company';
    this.accessToken = null;
  }

  async authenticate(credentials) {
    // OAuth 2.0 authentication for QuickBooks
    this.accessToken = credentials.accessToken;
    this.companyId = credentials.companyId;
  }

  async uploadFile(file, settings) {
    // Upload invoice to QuickBooks
    const formData = new FormData();
    formData.append('file', file.buffer, file.name);
    
    const response = await axios.post(
      `${this.baseUrl}/${this.companyId}/upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data;
  }

  async sendData(data) {
    // Create invoice/bill in QuickBooks
    const response = await axios.post(
      `${this.baseUrl}/${this.companyId}/bill`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  }
}

/**
 * Dropbox Integration
 */
class DropboxIntegration {
  constructor() {
    this.baseUrl = 'https://api.dropboxapi.com/2';
    this.accessToken = null;
  }

  async authenticate(credentials) {
    this.accessToken = credentials.accessToken;
  }

  async uploadFile(file, settings) {
    const uploadPath = settings.folder ? `/${settings.folder}/${file.name}` : `/${file.name}`;
    
    const response = await axios.post(
      `${this.baseUrl}/files/upload`,
      file.buffer,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: uploadPath,
            mode: 'add',
            autorename: true
          }),
          'Content-Type': 'application/octet-stream'
        }
      }
    );
    
    return response.data;
  }

  async sendData(data) {
    // Create a JSON file with the data
    const jsonContent = JSON.stringify(data, null, 2);
    const fileName = `automation_data_${Date.now()}.json`;
    
    return await this.uploadFile({
      name: fileName,
      buffer: Buffer.from(jsonContent)
    }, {});
  }
}

/**
 * Google Drive Integration
 */
class GoogleDriveIntegration {
  constructor() {
    this.baseUrl = 'https://www.googleapis.com/drive/v3';
    this.uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files';
    this.accessToken = null;
  }

  async authenticate(credentials) {
    this.accessToken = credentials.accessToken;
  }

  async uploadFile(file, settings) {
    const metadata = {
      name: file.name,
      parents: settings.folderId ? [settings.folderId] : undefined
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', file.buffer);

    const response = await axios.post(
      `${this.uploadUrl}?uploadType=multipart`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'multipart/related'
        }
      }
    );
    
    return response.data;
  }

  async sendData(data) {
    const jsonContent = JSON.stringify(data, null, 2);
    const fileName = `automation_data_${Date.now()}.json`;
    
    return await this.uploadFile({
      name: fileName,
      buffer: Buffer.from(jsonContent)
    }, {});
  }
}

/**
 * Salesforce Integration
 */
class SalesforceIntegration {
  constructor() {
    this.baseUrl = null; // Set during authentication
    this.accessToken = null;
  }

  async authenticate(credentials) {
    this.accessToken = credentials.accessToken;
    this.baseUrl = credentials.instanceUrl;
  }

  async sendData(data) {
    // Create records in Salesforce
    const response = await axios.post(
      `${this.baseUrl}/services/data/v54.0/sobjects/${data.objectType}`,
      data.fields,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  }

  async uploadFile(file, settings) {
    // Upload as attachment or document
    const attachment = {
      Name: file.name,
      Body: file.buffer.toString('base64'),
      ParentId: settings.parentId
    };

    return await this.sendData({
      objectType: 'Attachment',
      fields: attachment
    });
  }
}

/**
 * Slack Integration
 */
class SlackIntegration {
  constructor() {
    this.baseUrl = 'https://slack.com/api';
    this.accessToken = null;
  }

  async authenticate(credentials) {
    this.accessToken = credentials.accessToken;
  }

  async sendData(data) {
    // Send message to Slack channel
    const response = await axios.post(
      `${this.baseUrl}/chat.postMessage`,
      {
        channel: data.channel,
        text: data.message,
        attachments: data.attachments || []
      },
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  }

  async uploadFile(file, settings) {
    const formData = new FormData();
    formData.append('file', file.buffer, file.name);
    formData.append('channels', settings.channel);
    formData.append('title', settings.title || file.name);

    const response = await axios.post(
      `${this.baseUrl}/files.upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data;
  }
}

/**
 * Zapier Integration (via webhooks)
 */
class ZapierIntegration {
  constructor() {
    this.webhookUrl = null;
  }

  async authenticate(credentials) {
    this.webhookUrl = credentials.webhookUrl;
  }

  async sendData(data) {
    const response = await axios.post(this.webhookUrl, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }

  async uploadFile(file, settings) {
    // Send file metadata and base64 content to Zapier
    const fileData = {
      fileName: file.name,
      fileSize: file.buffer.length,
      mimeType: file.mimetype,
      content: file.buffer.toString('base64'),
      ...settings
    };
    
    return await this.sendData(fileData);
  }
}

module.exports = { IntegrationFramework };