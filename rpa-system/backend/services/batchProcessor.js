const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

/**
 * Batch Processing Service for EasyFlow
 * Enables bulk operations like processing 50+ invoices from multiple vendors
 */
class BatchProcessor {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
    this.maxConcurrent = 3; // Limit concurrent operations
    this.retryAttempts = 3;
  }

  /**
   * Process multiple invoice downloads from different vendors
   */
  async processBulkInvoices(batchConfig) {
    const { userId, vendors, outputPath, namingPattern } = batchConfig;
    
    try {
      // Create batch execution record
      const { data: batch, error: batchError } = await this.supabase
        .from('batch_executions')
        .insert({
          user_id: userId,
          type: 'bulk_invoice_download',
          total_items: vendors.length,
          status: 'running',
          config: JSON.stringify(batchConfig)
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const results = [];
      const chunks = this.chunkArray(vendors, this.maxConcurrent);

      for (const chunk of chunks) {
        const promises = chunk.map(vendor => 
          this.processVendorInvoices(vendor, outputPath, namingPattern, batch.id)
        );
        
        const chunkResults = await Promise.allSettled(promises);
        results.push(...chunkResults);
        
        // Update progress
        await this.updateBatchProgress(batch.id, results.length, vendors.length);
      }

      // Finalize batch
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      await this.supabase
        .from('batch_executions')
        .update({
          status: 'completed',
          completed_items: successCount,
          failed_items: failureCount,
          ended_at: new Date().toISOString(),
          results: JSON.stringify(results)
        })
        .eq('id', batch.id);

      return {
        batchId: batch.id,
        totalProcessed: vendors.length,
        successful: successCount,
        failed: failureCount,
        results: results
      };

    } catch (error) {
      console.error('[BatchProcessor] Bulk invoice processing failed:', error);
      throw error;
    }
  }

  /**
   * Process invoices for a single vendor
   */
  async processVendorInvoices(vendor, outputPath, namingPattern, batchId) {
    const { name, loginUrl, username, password, invoiceSelector, dateRange } = vendor;
    
    try {
      // Create automation task for this vendor
      const taskData = {
        url: loginUrl,
        username: username,
        password: password,
        task_type: 'bulk_invoice_download',
        parameters: {
          vendor_name: name,
          invoice_selector: invoiceSelector,
          date_range: dateRange,
          output_path: outputPath,
          naming_pattern: namingPattern
        }
      };

      // Execute automation with retry logic
      let lastError;
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          const result = await this.executeVendorAutomation(taskData, batchId);
          
          // Process and rename downloaded files
          if (result.success && result.downloadedFiles) {
            await this.processDownloadedFiles(result.downloadedFiles, vendor, namingPattern);
          }
          
          return {
            vendor: name,
            success: true,
            filesProcessed: result.downloadedFiles?.length || 0,
            result: result
          };
          
        } catch (error) {
          lastError = error;
          if (attempt < this.retryAttempts) {
            await this.sleep(attempt * 2000); // Exponential backoff
          }
        }
      }
      
      throw lastError;
      
    } catch (error) {
      console.error(`[BatchProcessor] Vendor ${name} processing failed:`, error);
      return {
        vendor: name,
        success: false,
        error: error.message,
        filesProcessed: 0
      };
    }
  }

  /**
   * Process and rename downloaded files with intelligent naming
   */
  async processDownloadedFiles(files, vendor, namingPattern) {
    for (const file of files) {
      try {
        const metadata = await this.extractFileMetadata(file.path);
        const newName = this.generateFileName(namingPattern, {
          vendor: vendor.name,
          date: metadata.date || new Date().toISOString().split('T')[0],
          amount: metadata.amount,
          invoiceNumber: metadata.invoiceNumber,
          originalName: path.basename(file.path)
        });

        const newPath = path.join(path.dirname(file.path), newName);
        
        if (fs.existsSync(file.path)) {
          fs.renameSync(file.path, newPath);
          
          // Update file record in database
          await this.supabase
            .from('user_files')
            .update({
              file_name: newName,
              file_path: newPath,
              metadata: JSON.stringify(metadata)
            })
            .eq('file_path', file.path);
        }
        
      } catch (error) {
        console.error('[BatchProcessor] File processing error:', error);
      }
    }
  }

  /**
   * Extract metadata from invoice files using AI/OCR
   */
  async extractFileMetadata(filePath) {
    try {
      // Placeholder for AI-powered metadata extraction
      // This would integrate with OCR service to extract:
      // - Invoice date
      // - Amount
      // - Invoice number
      // - Vendor details
      
      const stats = fs.statSync(filePath);
      
      return {
        date: stats.mtime.toISOString().split('T')[0],
        amount: null, // To be extracted by AI
        invoiceNumber: null, // To be extracted by AI
        fileSize: stats.size,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[BatchProcessor] Metadata extraction failed:', error);
      return {};
    }
  }

  /**
   * Generate intelligent file names
   */
  generateFileName(pattern, data) {
    let fileName = pattern;
    
    // Replace placeholders with actual data
    fileName = fileName
      .replace('{vendor}', this.sanitizeFileName(data.vendor))
      .replace('{date}', data.date)
      .replace('{amount}', data.amount || 'unknown')
      .replace('{invoice_number}', data.invoiceNumber || 'unknown')
      .replace('{timestamp}', Date.now());

    // Ensure file extension
    if (!path.extname(fileName)) {
      fileName += path.extname(data.originalName) || '.pdf';
    }

    return fileName;
  }

  /**
   * Execute vendor-specific automation
   */
  async executeVendorAutomation(taskData, batchId) {
    // This would call the existing automation service
    // Enhanced to handle vendor-specific login flows and invoice collection
    
    const response = await fetch(`${process.env.AUTOMATION_URL}/automate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AUTOMATION_API_KEY}`
      },
      body: JSON.stringify({
        ...taskData,
        batch_id: batchId,
        enhanced_mode: true // Flag for bulk processing mode
      })
    });

    if (!response.ok) {
      throw new Error(`Automation service error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Update batch execution progress
   */
  async updateBatchProgress(batchId, completed, total) {
    const progress = Math.round((completed / total) * 100);
    
    await this.supabase
      .from('batch_executions')
      .update({
        completed_items: completed,
        progress_percent: progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);
  }

  /**
   * Utility functions
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sanitizeFileName(name) {
    return name
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BatchProcessor };