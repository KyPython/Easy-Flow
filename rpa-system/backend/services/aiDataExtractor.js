
const { logger, getLogger } = require('../utils/logger');
const axios = require('axios');
const FormData = require('form-data');

// ✅ INSTRUCTION 2: Import OpenTelemetry for external API span instrumentation
const { trace, SpanStatusCode, SpanKind, context, propagation } = require('@opentelemetry/api');

/**
 * AI-Powered Data Extraction Service
 * Uses OpenAI API and OCR to extract structured data from documents and web pages
 */
class AIDataExtractor {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
    
    // ✅ INSTRUCTION 2: Get tracer for external API operations
    this.tracer = trace.getTracer('external-api.openai');
    
    // ✅ INSTRUCTION 2: Create instrumented HTTP client for OpenAI
    this.httpClient = this._createInstrumentedClient();
  }
  
  /**
   * ✅ INSTRUCTION 2: Create Axios instance with trace propagation for OpenAI calls
   */
  _createInstrumentedClient() {
    const client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor for trace propagation
    client.interceptors.request.use(
      (config) => {
        // Inject trace context into headers
        const carrier = {};
        propagation.inject(context.active(), carrier);
        config.headers = { ...config.headers, ...carrier };
        
        // Add OpenAI-specific auth header
        if (this.openaiApiKey) {
          config.headers['Authorization'] = `Bearer ${this.openaiApiKey}`;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    return client;
  }

  /**
   * Extract structured data from invoice PDFs or images
   */
  async extractInvoiceData(fileBuffer, fileName) {
    try {
      // First, extract text using OCR if it's an image
      let textContent = '';
      
      if (this.isImageFile(fileName)) {
        textContent = await this.performOCR(fileBuffer);
      } else if (this.isPDFFile(fileName)) {
        textContent = await this.extractPDFText(fileBuffer);
      } else {
        throw new Error('Unsupported file type for invoice extraction');
      }

      // Use AI to structure the extracted text
      const structuredData = await this.structureInvoiceData(textContent);
      
      return {
        success: true,
        extractedText: textContent,
        structuredData: structuredData,
        metadata: {
          fileName: fileName,
          extractedAt: new Date().toISOString(),
          confidence: structuredData.confidence || 0.8
        }
      };
      
    } catch (error) {
      logger.error('[AIDataExtractor] Invoice extraction failed:', error);
      return {
        success: false,
        error: error.message,
        extractedText: '',
        structuredData: null
      };
    }
  }

  /**
   * Extract data from web pages using AI
   */
  async extractWebPageData(htmlContent, extractionTargets) {
    try {
      // Clean HTML and extract relevant content
      const cleanText = this.cleanHTML(htmlContent);
      
      // Use AI to extract specific data points
      const extractedData = await this.extractSpecificData(cleanText, extractionTargets);
      
      return {
        success: true,
        extractedData: extractedData,
        metadata: {
          extractedAt: new Date().toISOString(),
          targetFields: extractionTargets
        }
      };
      
    } catch (error) {
      logger.error('[AIDataExtractor] Web page extraction failed:', error);
      return {
        success: false,
        error: error.message,
        extractedData: null
      };
    }
  }

  /**
   * ✅ INSTRUCTION 2: Structure raw invoice text with OpenTelemetry span instrumentation
   */
  async structureInvoiceData(textContent) {
    const prompt = `
Extract the following information from this invoice text and return it as JSON:

Required fields:
- vendor_name: Company/vendor name
- invoice_number: Invoice number
- invoice_date: Date (YYYY-MM-DD format)
- due_date: Due date (YYYY-MM-DD format)
- total_amount: Total amount (number only)
- currency: Currency code (USD, EUR, etc.)
- line_items: Array of items with description, quantity, unit_price, total
- billing_address: Complete billing address
- payment_terms: Payment terms if specified

Text to analyze:
${textContent}

Return valid JSON only, no additional text.
`;

    // ✅ INSTRUCTION 2: Create span for OpenAI API call
    return await this.tracer.startActiveSpan(
      'openai.chat.completion.invoice_extraction',
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': 'POST',
          'http.url': `${this.baseUrl}/chat/completions`,
          'peer.service': 'openai',
          'openai.model': 'gpt-4',
          'openai.operation': 'invoice_extraction',
          'openai.text_length': textContent.length,
          'openai.max_tokens': 2000
        }
      },
      async (span) => {
        const startTime = Date.now();
        
        try {
          const response = await this.httpClient.post(
            '/chat/completions',
            {
              model: 'gpt-4',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert at extracting structured data from invoices. Always return valid JSON.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.1,
              max_tokens: 2000
            }
          );

          const duration = Date.now() - startTime;
          const extractedText = response.data.choices[0].message.content;
          
          // Parse the JSON response
          const structuredData = JSON.parse(extractedText);
          
          // Add confidence score based on completeness
          structuredData.confidence = this.calculateConfidence(structuredData);
          
          // ✅ Set span success attributes
          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('http.status_code', response.status);
          span.setAttribute('openai.duration_ms', duration);
          span.setAttribute('openai.tokens_used', response.data.usage?.total_tokens || 0);
          span.setAttribute('openai.finish_reason', response.data.choices[0].finish_reason);
          span.setAttribute('openai.confidence_score', structuredData.confidence);
          
          return structuredData;
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // ✅ Record exception and set error status
          span.recordException(error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: error.message 
          });
          span.setAttribute('openai.duration_ms', duration);
          span.setAttribute('error', true);
          span.setAttribute('http.status_code', error.response?.status || 0);
          
          logger.error('[AIDataExtractor] AI structuring failed:', error);
          
          // Preserve rate limit status codes
          if (error.response?.status === 429) {
            const rateLimitError = new Error('Rate limit exceeded. The AI extraction service is temporarily busy. Please wait a moment and try again.');
            rateLimitError.statusCode = 429;
            throw rateLimitError;
          }
          
          throw new Error(`Failed to structure invoice data: ${error.message}`);
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * ✅ INSTRUCTION 2: Extract specific data points with OpenTelemetry span instrumentation
   */
  async extractSpecificData(content, targets) {
    const targetDescriptions = targets.map(t => `${t.name}: ${t.description}`).join('\n');
    
    const prompt = `
Extract the following specific data points from this web content:

Target data points:
${targetDescriptions}

Content to analyze:
${content.substring(0, 4000)} // Limit content length

Return the results as JSON with the target names as keys.
If a data point cannot be found, set its value to null.
`;

    // ✅ INSTRUCTION 2: Create span for OpenAI API call
    return await this.tracer.startActiveSpan(
      'openai.chat.completion.data_extraction',
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': 'POST',
          'http.url': `${this.baseUrl}/chat/completions`,
          'peer.service': 'openai',
          'openai.model': 'gpt-3.5-turbo',
          'openai.operation': 'data_extraction',
          'openai.target_count': targets.length,
          'openai.content_length': content.length,
          'openai.max_tokens': 1000
        }
      },
      async (span) => {
        const startTime = Date.now();
        
        try {
          const response = await this.httpClient.post(
            '/chat/completions',
            {
              model: 'gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert at extracting specific data from web content. Always return valid JSON.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.1,
              max_tokens: 1000
            }
          );

          const duration = Date.now() - startTime;
          const extractedText = response.data.choices[0].message.content;
          const parsedData = JSON.parse(extractedText);
          
          // ✅ Set span success attributes
          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('http.status_code', response.status);
          span.setAttribute('openai.duration_ms', duration);
          span.setAttribute('openai.tokens_used', response.data.usage?.total_tokens || 0);
          span.setAttribute('openai.finish_reason', response.data.choices[0].finish_reason);
          
          return parsedData;
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // ✅ Record exception and set error status
          span.recordException(error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: error.message 
          });
          span.setAttribute('openai.duration_ms', duration);
          span.setAttribute('error', true);
          span.setAttribute('http.status_code', error.response?.status || 0);
          
          logger.error('[AIDataExtractor] Specific data extraction failed:', error);
          
          // Preserve rate limit status codes
          if (error.response?.status === 429) {
            const rateLimitError = new Error('Rate limit exceeded. The AI extraction service is temporarily busy. Please wait a moment and try again.');
            rateLimitError.statusCode = 429;
            throw rateLimitError;
          }
          
          throw new Error(`Failed to extract specific data: ${error.message}`);
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Perform OCR on image files
   */
  async performOCR(imageBuffer) {
    try {
      // Convert image to base64 for OpenAI Vision API
      const base64Image = imageBuffer.toString('base64');
      
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this image. Return only the text content, preserving the layout as much as possible.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
      
    } catch (error) {
      logger.error('[AIDataExtractor] OCR failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF files
   */
  async extractPDFText(pdfBuffer) {
    // Placeholder for PDF text extraction
    // In production, would use libraries like pdf-parse or pdf2pic + OCR
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(pdfBuffer);
      return data.text;
    } catch (error) {
      logger.error('[AIDataExtractor] PDF text extraction failed:', error);
      
      // Fallback: Convert PDF to image and use OCR
      return await this.convertPDFToImageAndOCR(pdfBuffer);
    }
  }

  /**
   * Convert PDF to image and perform OCR
   */
  async convertPDFToImageAndOCR(pdfBuffer) {
    try {
      // This would require pdf2pic or similar library
      // For now, return placeholder
      throw new Error('PDF to image conversion not implemented');
    } catch (error) {
      logger.error('[AIDataExtractor] PDF to image conversion failed:', error);
      return 'Could not extract text from PDF';
    }
  }

  /**
   * Clean HTML content for better AI processing
   */
  cleanHTML(htmlContent) {
    return htmlContent
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
      .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate confidence score based on data completeness
   */
  calculateConfidence(data) {
    const requiredFields = ['vendor_name', 'invoice_number', 'invoice_date', 'total_amount'];
    const presentFields = requiredFields.filter(field => data[field] && data[field] !== null && data[field] !== '');
    
    const baseScore = presentFields.length / requiredFields.length;
    
    // Bonus points for additional fields
    const bonusFields = ['due_date', 'line_items', 'currency'];
    const bonusPoints = bonusFields.filter(field => data[field] && data[field] !== null).length * 0.05;
    
    return Math.min(1.0, baseScore + bonusPoints);
  }

  /**
   * Utility functions
   */
  isImageFile(fileName) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  isPDFFile(fileName) {
    return fileName.toLowerCase().endsWith('.pdf');
  }

  /**
   * Extract table data from HTML/text using AI
   */
  async extractTableData(content, tableDescription) {
    const prompt = `
Extract table data from the following content. The table contains: ${tableDescription}

Return the data as a JSON array where each object represents a row.
Use descriptive field names based on the column headers.

Content:
${content.substring(0, 3000)}

Return valid JSON only.
`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at extracting table data from text. Always return valid JSON arrays.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const extractedText = response.data.choices[0].message.content;
      return JSON.parse(extractedText);
      
    } catch (error) {
      logger.error('[AIDataExtractor] Table extraction failed:', error);
      throw new Error(`Failed to extract table data: ${error.message}`);
    }
  }
}

module.exports = { AIDataExtractor };