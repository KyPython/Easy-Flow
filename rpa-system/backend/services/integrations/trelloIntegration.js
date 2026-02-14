const axios = require('axios');
const FormData = require('form-data');

class TrelloIntegration {
  constructor() {
    this.key = null;
    this.token = null;
    this.listId = null; // target list to create cards
    this.baseUrl = 'https://api.trello.com/1';
  }

  async authenticate(credentials) {
    // credentials: { key, token, listId }
    this.key = credentials.key;
    this.token = credentials.token;
    this.listId = credentials.listId;
  }

  async sendData(data) {
    // Create a card with title/description
    const name = data.name || data.title || `Automation Card ${Date.now()}`;
    const desc = data.desc || data.description || JSON.stringify(data);

    const response = await axios.post(
      `${this.baseUrl}/cards`,
      null,
      {
        params: { idList: this.listId, key: this.key, token: this.token, name, desc }
      }
    );

    return response.data;
  }

  async uploadFile(file, settings = {}) {
    // Create a card, then attach the file
    const card = await this.sendData({ name: file.name, desc: settings.desc || 'File uploaded via ModeLogic' });

    const form = new FormData();
    form.append('file', file.buffer, file.name);

    const attachResponse = await axios.post(
      `${this.baseUrl}/cards/${card.id}/attachments`,
      form,
      {
        headers: form.getHeaders(),
        params: { key: this.key, token: this.token }
      }
    );

    return { id: attachResponse.data?.id, url: attachResponse.data?.url };
  }
}

module.exports = TrelloIntegration;
