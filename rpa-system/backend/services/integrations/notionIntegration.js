/**
 * Notion Integration for EasyFlow
 * Handles reading and writing pages, databases, and content to Notion
 */

const axios = require('axios');
const { logger } = require('../../utils/logger');

class NotionIntegration {
  constructor() {
    this.accessToken = null;
    this.baseUrl = 'https://api.notion.com/v1';
  }

  /**
   * Authenticate with Notion
   * @param {Object} credentials - { accessToken }
   */
  async authenticate(credentials) {
    const { accessToken } = credentials;
    
    if (!accessToken) {
      throw new Error('Notion access token is required');
    }
    
    this.accessToken = accessToken;
    
    // Verify authentication by getting user info
    try {
      const response = await axios.get(`${this.baseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28'
        }
      });
      
      logger.info('[NotionIntegration] Authenticated successfully', {
        userId: response.data.id
      });
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Notion authentication failed: Invalid access token. Please reconnect the integration.');
      } else if (error.response?.status === 403) {
        throw new Error('Notion authentication failed: Access denied. Please check your Notion integration permissions.');
      }
      throw new Error(`Notion authentication failed: ${error.message}`);
    }
  }

  /**
   * Create a page in Notion
   * @param {Object} params - { parentId, title, content?, properties? }
   */
  async createPage(params) {
    const { parentId, title, content, properties = {} } = params;
    
    const pageData = {
      parent: {
        page_id: parentId
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title
              }
            }
          ]
        },
        ...properties
      }
    };
    
    // Add content if provided
    if (content) {
      pageData.children = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: content
                }
              }
            ]
          }
        }
      ];
    }
    
    const response = await axios.post(`${this.baseUrl}/pages`, pageData, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      pageId: response.data.id,
      url: response.data.url
    };
  }

  /**
   * Read a page from Notion
   * @param {Object} params - { pageId }
   */
  async readPage(params) {
    const { pageId } = params;
    
    const response = await axios.get(`${this.baseUrl}/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    return {
      success: true,
      page: response.data
    };
  }

  /**
   * Update a page in Notion
   * @param {Object} params - { pageId, properties?, content? }
   */
  async updatePage(params) {
    const { pageId, properties, content } = params;
    
    const updateData = {};
    if (properties) {
      updateData.properties = properties;
    }
    
    const response = await axios.patch(`${this.baseUrl}/pages/${pageId}`, updateData, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      pageId: response.data.id,
      url: response.data.url
    };
  }

  /**
   * Query a database in Notion
   * @param {Object} params - { databaseId, filter?, sorts? }
   */
  async queryDatabase(params) {
    const { databaseId, filter, sorts } = params;
    
    const queryData = {};
    if (filter) queryData.filter = filter;
    if (sorts) queryData.sorts = sorts;
    
    const response = await axios.post(`${this.baseUrl}/databases/${databaseId}/query`, queryData, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      results: response.data.results,
      hasMore: response.data.has_more,
      nextCursor: response.data.next_cursor
    };
  }

  /**
   * Send data to Notion (alias for createPage for compatibility)
   * @param {Object} data - { parentId, title, content, properties? }
   */
  async sendData(data) {
    return this.createPage(data);
  }
}

module.exports = NotionIntegration;

