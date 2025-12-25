/**
 * Company Enrichment Service
 * 
 * Enriches company profiles with additional data:
 * - Industry classification
 * - Headcount
 * - Funding stage
 * - Location
 * - Tech stack
 * 
 * Integrates with:
 * - Clearbit API (if available)
 * - Manual enrichment
 * - Scraped data
 */

const { createLogger } = require('../middleware/structuredLogging');
const axios = require('axios');
const { getSupabase } = require('../utils/supabaseClient');
const { config } = require('../utils/appConfig');

const logger = createLogger('service.companyEnrichment');

class CompanyEnrichmentService {
  constructor() {
    this.clearbitApiKey = process.env.CLEARBIT_API_KEY || '';
    this.enrichmentCache = new Map(); // domain -> { data, timestamp }
    // Cache TTL configurable via environment variable (default: 24 hours)
    this.cacheTTL = parseInt(process.env.COMPANY_ENRICHMENT_CACHE_TTL_MS || String(24 * 60 * 60 * 1000), 10);
  }

  /**
   * Enrich company profile from domain
   */
  async enrichCompany(domain, options = {}) {
    try {
      // Check cache first
      const cached = this.enrichmentCache.get(domain);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        logger.debug('Returning cached enrichment data', { domain });
        return {
          success: true,
          data: cached.data,
          source: 'cache'
        };
      }

      // Try Clearbit first if API key is available
      if (this.clearbitApiKey && !options.skipClearbit) {
        const clearbitData = await this._enrichWithClearbit(domain);
        if (clearbitData.success) {
          this.enrichmentCache.set(domain, {
            data: clearbitData.data,
            timestamp: Date.now()
          });
          return clearbitData;
        }
      }

      // Fallback to database lookup
      const dbData = await this._getFromDatabase(domain);
      if (dbData) {
        return {
          success: true,
          data: dbData,
          source: 'database'
        };
      }

      // Try to extract from domain/URL
      const basicData = this._extractBasicInfo(domain);
      
      return {
        success: true,
        data: basicData,
        source: 'extracted'
      };
    } catch (error) {
      logger.error('Failed to enrich company', error, { domain });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enrich with Clearbit API
   */
  async _enrichWithClearbit(domain) {
    if (!this.clearbitApiKey) {
      return { success: false, error: 'Clearbit API key not configured' };
    }

    try {
      const response = await axios.get(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
        headers: {
          'Authorization': `Bearer ${this.clearbitApiKey}`
        },
        timeout: 10000
      });

      const data = response.data;

      return {
        success: true,
        data: {
          name: data.name || null,
          domain: data.domain || domain,
          industry: data.category?.industry || data.industry || null,
          headcount: data.metrics?.employees || data.employees || null,
          fundingStage: this._determineFundingStage(data),
          location: data.geo?.city && data.geo?.state 
            ? `${data.geo.city}, ${data.geo.state}` 
            : data.location || null,
          description: data.description || null,
          website: data.domain ? `https://${data.domain}` : null,
          linkedin: data.linkedin?.handle ? `https://linkedin.com/company/${data.linkedin.handle}` : null,
          techStack: data.tech || [],
          enrichmentSource: 'clearbit',
          enrichmentData: data
        },
        source: 'clearbit'
      };
    } catch (error) {
      if (error.response?.status === 404) {
        logger.debug('Company not found in Clearbit', { domain });
      } else {
        logger.warn('Clearbit API error', { domain, error: error.message });
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get company data from database
   */
  async _getFromDatabase(domain) {
    try {
      const supabase = getSupabase();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('domain', domain)
        .single();

      if (error || !data) return null;

      return {
        name: data.name,
        domain: data.domain,
        industry: data.industry,
        headcount: data.headcount,
        fundingStage: data.funding_stage,
        location: data.location,
        enrichmentSource: data.enrichment_source || 'database',
        enrichmentData: data.enrichment_data
      };
    } catch (error) {
      logger.error('Database lookup failed', error, { domain });
      return null;
    }
  }

  /**
   * Extract basic info from domain
   */
  _extractBasicInfo(domain) {
    // Remove www. and extract company name
    const cleanDomain = domain.replace(/^www\./, '');
    const companyName = cleanDomain.split('.')[0];
    const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

    return {
      name: capitalizedName,
      domain: cleanDomain,
      industry: null,
      headcount: null,
      fundingStage: null,
      location: null,
      enrichmentSource: 'extracted',
      enrichmentData: {}
    };
  }

  /**
   * Determine funding stage from Clearbit data
   */
  _determineFundingStage(clearbitData) {
    // Check if there's funding information
    if (clearbitData.metrics?.raised) {
      const raised = clearbitData.metrics.raised;
      if (raised > 100000000) return 'Series C+';
      if (raised > 50000000) return 'Series B';
      if (raised > 10000000) return 'Series A';
      if (raised > 1000000) return 'Seed';
      return 'Pre-Seed';
    }

    // Check employee count as proxy
    const employees = clearbitData.metrics?.employees || clearbitData.employees;
    if (employees) {
      if (employees > 1000) return 'Growth';
      if (employees > 500) return 'Scale-up';
      if (employees > 100) return 'Series A/B';
      if (employees > 10) return 'Seed';
      return 'Early Stage';
    }

    return null;
  }

  /**
   * Save enriched company data to database
   */
  async saveCompanyProfile(domain, enrichmentData) {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        logger.warn('Database not available, skipping save', { domain });
        return { success: false, error: 'Database not available' };
      }

      const { data, error } = await supabase
        .from('company_profiles')
        .upsert({
          domain,
          name: enrichmentData.name,
          industry: enrichmentData.industry,
          headcount: enrichmentData.headcount,
          funding_stage: enrichmentData.fundingStage,
          location: enrichmentData.location,
          enriched_at: new Date().toISOString(),
          enrichment_source: enrichmentData.enrichmentSource || 'manual',
          enrichment_data: enrichmentData.enrichmentData || {}
        }, {
          onConflict: 'domain'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Company profile saved', { domain });
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to save company profile', error, { domain });
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch enrich multiple companies
   */
  async enrichBatch(domains, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 10;

    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      const batchPromises = batch.map(domain => this.enrichCompany(domain, options));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting: wait between batches
      if (i + batchSize < domains.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

// Singleton instance
let enrichmentInstance = null;

function getCompanyEnrichmentService() {
  if (!enrichmentInstance) {
    enrichmentInstance = new CompanyEnrichmentService();
  }
  return enrichmentInstance;
}

module.exports = {
  CompanyEnrichmentService,
  getCompanyEnrichmentService
};

