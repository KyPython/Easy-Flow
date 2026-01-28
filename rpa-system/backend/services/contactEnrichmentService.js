/**
 * Contact Enrichment Service
 *
 * Enriches contacts with email addresses and professional information:
 * - Hunter.io integration
 * - RocketReach integration
 * - Apollo.io integration
 * - Decision-maker matching
 *
 * Features:
 * - Email verification
 * - LinkedIn profile matching
 * - Role/title extraction
 * - Company association
 */

const { createLogger } = require('../middleware/structuredLogging');
const axios = require('axios');
const { getSupabase } = require('../utils/supabaseClient');

const logger = createLogger('service.contactEnrichment');

class ContactEnrichmentService {
 constructor() {
 // API keys from environment
 this.hunterApiKey = process.env.HUNTER_API_KEY || '';
 this.rocketReachApiKey = process.env.ROCKETREACH_API_KEY || '';
 this.apolloApiKey = process.env.APOLLO_API_KEY || '';

 // Cache for enrichment results
 this.enrichmentCache = new Map();
 // Cache TTL configurable via environment variable (default: 7 days)
 this.cacheTTL = parseInt(process.env.CONTACT_ENRICHMENT_CACHE_TTL_MS || String(7 * 24 * 60 * 60 * 1000), 10);
 }

 /**
 * Enrich contact by name and company domain
 */
 async enrichContact(firstName, lastName, companyDomain, options = {}) {
 try {
 const cacheKey = `${firstName}-${lastName}-${companyDomain}`;
 const cached = this.enrichmentCache.get(cacheKey);
 if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
 logger.debug('Returning cached enrichment', { cacheKey });
 return { success: true, data: cached.data, source: 'cache' };
 }

 // Try providers in order of preference
 let result = null;

 // 1. Try Hunter.io first (best for email finding)
 if (this.hunterApiKey && !options.skipHunter) {
 result = await this._enrichWithHunter(firstName, lastName, companyDomain);
 if (result.success) {
 this.enrichmentCache.set(cacheKey, { data: result.data, timestamp: Date.now() });
 return { ...result, source: 'hunter' };
 }
 }

 // 2. Try Apollo.io (good for decision-makers)
 if (this.apolloApiKey && !options.skipApollo) {
 result = await this._enrichWithApollo(firstName, lastName, companyDomain);
 if (result.success) {
 this.enrichmentCache.set(cacheKey, { data: result.data, timestamp: Date.now() });
 return { ...result, source: 'apollo' };
 }
 }

 // 3. Try RocketReach (backup)
 if (this.rocketReachApiKey && !options.skipRocketReach) {
 result = await this._enrichWithRocketReach(firstName, lastName, companyDomain);
 if (result.success) {
 this.enrichmentCache.set(cacheKey, { data: result.data, timestamp: Date.now() });
 return { ...result, source: 'rocketreach' };
 }
 }

 // Return basic structure if no provider worked
 return {
 success: false,
 error: 'No enrichment provider available or contact not found',
 data: {
 firstName,
 lastName,
 companyDomain,
 email: null,
 verified: false
 }
 };
 } catch (error) {
 logger.error('Failed to enrich contact', error, { firstName, lastName, companyDomain });
 return {
 success: false,
 error: error.message
 };
 }
 }

 /**
 * Enrich with Hunter.io
 */
 async _enrichWithHunter(firstName, lastName, companyDomain) {
 if (!this.hunterApiKey) {
 return { success: false, error: 'Hunter.io API key not configured' };
 }

 try {
 // Hunter.io email finder API
 const response = await axios.get('https://api.hunter.io/v2/email-finder', {
 params: {
 domain: companyDomain,
 first_name: firstName,
 last_name: lastName,
 api_key: this.hunterApiKey
 },
 timeout: 10000
 });

 const data = response.data?.data;
 if (!data || !data.email) {
 return { success: false, error: 'Email not found' };
 }

 return {
 success: true,
 data: {
 email: data.email,
 firstName: data.first_name || firstName,
 lastName: data.last_name || lastName,
 companyDomain,
 verified: data.sources?.length > 0,
 confidence: data.score || 0,
 sources: data.sources || [],
 linkedin: data.linkedin || null,
 twitter: data.twitter || null,
 phone: data.phone || null,
 position: data.position || null,
 company: data.company || null
 }
 };
 } catch (error) {
 if (error.response?.status === 404) {
 logger.debug('Contact not found in Hunter.io', { firstName, lastName, companyDomain });
 } else {
 logger.warn('Hunter.io API error', { error: error.message });
 }
 return { success: false, error: error.message };
 }
 }

 /**
 * Enrich with Apollo.io
 */
 async _enrichWithApollo(firstName, lastName, companyDomain) {
 if (!this.apolloApiKey) {
 return { success: false, error: 'Apollo.io API key not configured' };
 }

 try {
 // Apollo.io person search API
 const response = await axios.post('https://api.apollo.io/v1/mixed_people/search', {
 api_key: this.apolloApiKey,
 q_keywords: `${firstName} ${lastName}`,
 person_titles: [],
 organization_domains: [companyDomain],
 page: 1,
 per_page: 1
 }, {
 timeout: 10000
 });

 const person = response.data?.people?.[0];
 if (!person || !person.email) {
 return { success: false, error: 'Contact not found' };
 }

 return {
 success: true,
 data: {
 email: person.email,
 firstName: person.first_name || firstName,
 lastName: person.last_name || lastName,
 companyDomain,
 verified: person.email_status === 'verified',
 confidence: person.email_status === 'verified' ? 90 : 50,
 linkedin: person.linkedin_url || null,
 title: person.title || null,
 company: person.organization?.name || null,
 phone: person.phone_numbers?.[0]?.raw_number || null
 }
 };
 } catch (error) {
 logger.warn('Apollo.io API error', { error: error.message });
 return { success: false, error: error.message };
 }
 }

 /**
 * Enrich with RocketReach
 */
 async _enrichWithRocketReach(firstName, lastName, companyDomain) {
 if (!this.rocketReachApiKey) {
 return { success: false, error: 'RocketReach API key not configured' };
 }

 try {
 // RocketReach person lookup API
 const response = await axios.get('https://api.rocketreach.co/v2/api/lookupProfile', {
 params: {
 name: `${firstName} ${lastName}`,
 current_employer: companyDomain,
 api_key: this.rocketReachApiKey
 },
 timeout: 10000
 });

 const profile = response.data?.profile;
 if (!profile || !profile.emails?.[0]) {
 return { success: false, error: 'Contact not found' };
 }

 return {
 success: true,
 data: {
 email: profile.emails[0].email,
 firstName: profile.first_name || firstName,
 lastName: profile.last_name || lastName,
 companyDomain,
 verified: profile.emails[0].status === 'verified',
 confidence: profile.emails[0].status === 'verified' ? 85 : 60,
 linkedin: profile.linkedin_url || null,
 title: profile.current_title || null,
 company: profile.current_employer || null,
 phone: profile.phone_numbers?.[0] || null
 }
 };
 } catch (error) {
 logger.warn('RocketReach API error', { error: error.message });
 return { success: false, error: error.message };
 }
 }

 /**
 * Find decision-makers at a company
 */
 async findDecisionMakers(companyDomain, department = null, options = {}) {
 try {
 const results = [];

 // Try Apollo.io for decision-maker search
 if (this.apolloApiKey) {
 const apolloResult = await this._findDecisionMakersApollo(companyDomain, department);
 if (apolloResult.success) {
 results.push(...apolloResult.contacts);
 }
 }

 // Try RocketReach
 if (this.rocketReachApiKey && results.length === 0) {
 const rrResult = await this._findDecisionMakersRocketReach(companyDomain, department);
 if (rrResult.success) {
 results.push(...rrResult.contacts);
 }
 }

 return {
 success: true,
 contacts: results,
 count: results.length
 };
 } catch (error) {
 logger.error('Failed to find decision-makers', error, { companyDomain, department });
 return {
 success: false,
 error: error.message,
 contacts: []
 };
 }
 }

 /**
 * Find decision-makers with Apollo.io
 */
 async _findDecisionMakersApollo(companyDomain, department = null) {
 try {
 const titles = department === 'engineering'
 ? ['CTO', 'VP Engineering', 'Engineering Manager', 'Head of Engineering']
 : department === 'sales'
 ? ['VP Sales', 'Sales Director', 'Head of Sales']
 : ['CEO', 'CTO', 'VP', 'Director', 'Head of'];

 const response = await axios.post('https://api.apollo.io/v1/mixed_people/search', {
 api_key: this.apolloApiKey,
 organization_domains: [companyDomain],
 person_titles: titles,
 page: 1,
 per_page: 10
 }, {
 timeout: 10000
 });

 const contacts = (response.data?.people || []).map(person => ({
 email: person.email,
 firstName: person.first_name,
 lastName: person.last_name,
 title: person.title,
 linkedin: person.linkedin_url,
 verified: person.email_status === 'verified'
 }));

 return { success: true, contacts };
 } catch (error) {
 return { success: false, error: error.message, contacts: [] };
 }
 }

 /**
 * Find decision-makers with RocketReach
 */
 async _findDecisionMakersRocketReach(companyDomain, department = null) {
 // RocketReach doesn't have a direct decision-maker search
 // Would need to use their company search and filter
 return { success: false, contacts: [] };
 }

 /**
 * Verify email address
 */
 async verifyEmail(email) {
 try {
 // Use Hunter.io email verifier if available
 if (this.hunterApiKey) {
 const response = await axios.get('https://api.hunter.io/v2/email-verifier', {
 params: {
 email,
 api_key: this.hunterApiKey
 },
 timeout: 10000
 });

 const data = response.data?.data;
 return {
 success: true,
 verified: data?.result === 'deliverable',
 score: data?.score || 0,
 sources: data?.sources || []
 };
 }

 // Basic regex validation as fallback
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 return {
 success: true,
 verified: emailRegex.test(email),
 score: emailRegex.test(email) ? 50 : 0,
 sources: []
 };
 } catch (error) {
 logger.warn('Email verification failed', { error: error.message, email });
 return {
 success: false,
 verified: false,
 error: error.message
 };
 }
 }

 /**
 * Batch enrich multiple contacts
 */
 async enrichBatch(contacts, options = {}) {
 const results = [];
 const batchSize = options.batchSize || 5;

 for (let i = 0; i < contacts.length; i += batchSize) {
 const batch = contacts.slice(i, i + batchSize);
 const batchPromises = batch.map(contact =>
 this.enrichContact(
 contact.firstName,
 contact.lastName,
 contact.companyDomain,
 options
 )
 );
 const batchResults = await Promise.all(batchPromises);
 results.push(...batchResults);

 // Rate limiting
 if (i + batchSize < contacts.length) {
 await new Promise(resolve => setTimeout(resolve, 2000));
 }
 }

 return results;
 }
}

// Singleton instance
let enrichmentInstance = null;

function getContactEnrichmentService() {
 if (!enrichmentInstance) {
 enrichmentInstance = new ContactEnrichmentService();
 }
 return enrichmentInstance;
}

module.exports = {
 ContactEnrichmentService,
 getContactEnrichmentService
};

