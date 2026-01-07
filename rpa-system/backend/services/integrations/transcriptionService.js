/**
 * Transcription Service for EasyFlow
 * Transcribes audio/video files using OpenAI Whisper API
 */

const axios = require('axios');
const FormData = require('form-data');
const { logger } = require('../../utils/logger');
const { createInstrumentedHttpClient } = require('../../middleware/httpInstrumentation');

class TranscriptionService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
    this.http = createInstrumentedHttpClient();

    if (!this.apiKey) {
      logger.warn('[TranscriptionService] OPENAI_API_KEY not set - transcription will fail');
    }
  }

  /**
   * Transcribe audio/video file
   * @param {Object} file - { buffer, name, mimetype }
   * @param {Object} options - { language?, prompt?, responseFormat? }
   */
  async transcribe(file, options = {}) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { language = null, prompt = null, responseFormat = 'json' } = options;

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.name,
      contentType: file.mimetype || 'audio/mpeg'
    });
    formData.append('model', 'whisper-1');
    formData.append('response_format', responseFormat);

    if (language) formData.append('language', language);
    if (prompt) formData.append('prompt', prompt);

    try {
      const response = await this.http.post(
        `${this.baseUrl}/audio/transcriptions`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders()
          },
          timeout: 300000 // 5 minutes for large files
        }
      );

      return {
        success: true,
        text: responseFormat === 'json' ? response.data.text : response.data,
        language: response.data.language,
        duration: response.data.duration
      };
    } catch (error) {
      logger.error('[TranscriptionService] Transcription failed:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe Google Meet recording
   * Downloads recording from Google Drive and transcribes it
   * @param {Object} params - { driveFileId, driveIntegration }
   */
  async transcribeMeetRecording(params) {
    const { driveFileId, driveIntegration } = params;

    // Download file from Google Drive
    const fileBuffer = await driveIntegration.downloadFile(driveFileId);

    // Transcribe
    return this.transcribe({
      buffer: fileBuffer,
      name: 'meet-recording.mp4',
      mimetype: 'video/mp4'
    });
  }

  /**
   * Extract key insights from transcription
   * Uses GPT to extract structured feedback/insights
   * @param {String} transcription - Transcribed text
   * @param {Object} options - { focus?, maxInsights? }
   */
  async extractInsights(transcription, options = {}) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { focus = 'customer feedback', maxInsights = 10 } = options;

    const prompt = `Extract key insights and feedback from the following transcription. Focus on: ${focus}

Transcription:
${transcription}

Return a JSON array of insights, each with:
- insight: The key point or feedback
- category: Type (e.g., "feature_request", "bug_report", "praise", "complaint")
- sentiment: "positive", "negative", or "neutral"
- priority: "high", "medium", or "low"

Limit to ${maxInsights} most important insights.`;

    try {
      const response = await this.http.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that extracts insights from customer conversations.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = JSON.parse(response.data.choices[0].message.content);

      return {
        success: true,
        insights: content.insights || [],
        summary: content.summary || null
      };
    } catch (error) {
      logger.error('[TranscriptionService] Insight extraction failed:', error);
      throw new Error(`Insight extraction failed: ${error.message}`);
    }
  }
}

module.exports = TranscriptionService;

