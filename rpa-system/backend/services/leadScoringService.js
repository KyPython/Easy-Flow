/**
 * Lead Scoring Service
 *
 * Calculates lead scores for companies based on:
 * - Hiring velocity (jobs posted over time)
 * - Seniority mix (ratio of senior vs junior roles)
 * - Tech stack signals
 * - Department signals
 * - Company growth indicators
 *
 * Supports ICP (Ideal Customer Profile) filtering with declarative rules.
 */

const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');
const { getCompanyEnrichmentService } = require('./companyEnrichmentService');

const logger = createLogger('service.leadScoring');

class LeadScoringService {
 constructor() {
 // Default scoring weights - configurable via environment variables
 this.defaultWeights = {
 hiringVelocity: parseFloat(process.env.LEAD_SCORE_WEIGHT_HIRING_VELOCITY || '0.3'),
 seniorityMix: parseFloat(process.env.LEAD_SCORE_WEIGHT_SENIORITY_MIX || '0.2'),
 techStack: parseFloat(process.env.LEAD_SCORE_WEIGHT_TECH_STACK || '0.2'),
 departmentSignals: parseFloat(process.env.LEAD_SCORE_WEIGHT_DEPARTMENT || '0.15'),
 companyGrowth: parseFloat(process.env.LEAD_SCORE_WEIGHT_COMPANY_GROWTH || '0.15')
 };

 // Hiring velocity thresholds - configurable via environment variables
 this.hiringVelocityThresholds = {
 high: parseInt(process.env.LEAD_SCORE_HIRING_HIGH_THRESHOLD || '10', 10),
 medium: parseInt(process.env.LEAD_SCORE_HIRING_MEDIUM_THRESHOLD || '5', 10),
 low: parseInt(process.env.LEAD_SCORE_HIRING_LOW_THRESHOLD || '2', 10),
 minimal: parseInt(process.env.LEAD_SCORE_HIRING_MINIMAL_THRESHOLD || '1', 10)
 };

 // Hiring velocity scores - configurable via environment variables
 this.hiringVelocityScores = {
 high: parseFloat(process.env.LEAD_SCORE_HIRING_HIGH_SCORE || '1.0'),
 medium: parseFloat(process.env.LEAD_SCORE_HIRING_MEDIUM_SCORE || '0.7'),
 low: parseFloat(process.env.LEAD_SCORE_HIRING_LOW_SCORE || '0.4'),
 minimal: parseFloat(process.env.LEAD_SCORE_HIRING_MINIMAL_SCORE || '0.2'),
 old: parseFloat(process.env.LEAD_SCORE_HIRING_OLD_SCORE || '0.1')
 };

 // Company growth thresholds - configurable via environment variables
 this.companyGrowthThresholds = {
 headcountLarge: parseInt(process.env.LEAD_SCORE_HEADCOUNT_LARGE || '500', 10),
 headcountMedium: parseInt(process.env.LEAD_SCORE_HEADCOUNT_MEDIUM || '100', 10),
 headcountSmall: parseInt(process.env.LEAD_SCORE_HEADCOUNT_SMALL || '50', 10),
 jobsHigh: parseInt(process.env.LEAD_SCORE_JOBS_HIGH || '10', 10),
 jobsMedium: parseInt(process.env.LEAD_SCORE_JOBS_MEDIUM || '5', 10)
 };

 // Company growth scores - configurable via environment variables
 this.companyGrowthScores = {
 headcountLarge: parseFloat(process.env.LEAD_SCORE_HEADCOUNT_LARGE_SCORE || '0.3'),
 headcountMedium: parseFloat(process.env.LEAD_SCORE_HEADCOUNT_MEDIUM_SCORE || '0.2'),
 headcountSmall: parseFloat(process.env.LEAD_SCORE_HEADCOUNT_SMALL_SCORE || '0.1'),
 jobsHigh: parseFloat(process.env.LEAD_SCORE_JOBS_HIGH_SCORE || '0.3'),
 jobsMedium: parseFloat(process.env.LEAD_SCORE_JOBS_MEDIUM_SCORE || '0.2'),
 jobsLow: parseFloat(process.env.LEAD_SCORE_JOBS_LOW_SCORE || '0.1')
 };

 // Time windows - configurable via environment variables
 this.timeWindows = {
 recentDays: parseInt(process.env.LEAD_SCORE_RECENT_DAYS || '30', 10),
 oldDays: parseInt(process.env.LEAD_SCORE_OLD_DAYS || '60', 10)
 };
 }

 /**
 * Calculate lead score for a company
 */
 async calculateLeadScore(companyDomain, options = {}) {
 try {
 logger.info('Calculating lead score', { companyDomain });

 // Get job postings for this company
 const jobPostings = await this._getJobPostings(companyDomain);

 // Get company profile
 const companyProfile = await this._getCompanyProfile(companyDomain);

 // Calculate individual signal scores
 const signals = {
 hiringVelocity: this._calculateHiringVelocity(jobPostings),
 seniorityMix: this._calculateSeniorityMix(jobPostings),
 techStack: this._calculateTechStackScore(jobPostings, options.techStackPreferences),
 departmentSignals: this._calculateDepartmentSignals(jobPostings, options.departmentPreferences),
 companyGrowth: this._calculateCompanyGrowthScore(companyProfile, jobPostings)
 };

 // Apply weights
 const weights = options.weights || this.defaultWeights;
 const score = (
 signals.hiringVelocity * weights.hiringVelocity +
 signals.seniorityMix * weights.seniorityMix +
 signals.techStack * weights.techStack +
 signals.departmentSignals * weights.departmentSignals +
 signals.companyGrowth * weights.companyGrowth
 ) * 100; // Scale to 0-100

 const finalScore = Math.min(100, Math.max(0, score));

 // Save score to database
 if (options.saveToDatabase !== false) {
 await this._saveLeadScore(companyDomain, finalScore, signals, options.userId);
 }

 return {
 success: true,
 score: finalScore,
 signals,
 companyDomain,
 jobPostingsCount: jobPostings.length,
 calculatedAt: new Date().toISOString()
 };
 } catch (error) {
 logger.error('Failed to calculate lead score', error, { companyDomain });
 return {
 success: false,
 error: error.message
 };
 }
 }

 /**
 * Calculate hiring velocity score (0-1)
 * Higher score = more jobs posted recently
 */
 _calculateHiringVelocity(jobPostings) {
 if (jobPostings.length === 0) return 0;

 const now = new Date();
 const recentDaysAgo = new Date(now.getTime() - this.timeWindows.recentDays * 24 * 60 * 60 * 1000);
 const oldDaysAgo = new Date(now.getTime() - this.timeWindows.oldDays * 24 * 60 * 60 * 1000);

 // Count jobs posted in recent window
 const recentJobs = jobPostings.filter(job => {
 if (!job.posting_date) return false;
 const postingDate = new Date(job.posting_date);
 return postingDate >= recentDaysAgo;
 }).length;

 // Count jobs posted in old window
 const oldJobs = jobPostings.filter(job => {
 if (!job.posting_date) return false;
 const postingDate = new Date(job.posting_date);
 return postingDate >= oldDaysAgo;
 }).length;

 // Score based on recent activity using configurable thresholds
 const thresholds = this.hiringVelocityThresholds;
 const scores = this.hiringVelocityScores;

 if (recentJobs >= thresholds.high) return scores.high;
 if (recentJobs >= thresholds.medium) return scores.medium;
 if (recentJobs >= thresholds.low) return scores.low;
 if (recentJobs >= thresholds.minimal) return scores.minimal;
 if (oldJobs > 0) return scores.old;
 return 0;
 }

 /**
 * Calculate seniority mix score (0-1)
 * Higher score = more senior roles (better for B2B sales)
 */
 _calculateSeniorityMix(jobPostings) {
 if (jobPostings.length === 0) return 0;

 const seniorityCounts = {
 executive: 0,
 senior: 0,
 mid: 0,
 junior: 0,
 intern: 0
 };

 jobPostings.forEach(job => {
 const seniority = job.seniority || 'mid';
 if (Object.prototype.hasOwnProperty.call(seniorityCounts, seniority)) {
 seniorityCounts[seniority]++;
 }
 });

 const total = jobPostings.length;
 const seniorRatio = (seniorityCounts.executive + seniorityCounts.senior) / total;
 const midRatio = seniorityCounts.mid / total;
 const juniorRatio = (seniorityCounts.junior + seniorityCounts.intern) / total;

 // Prefer companies with more senior roles
 // All senior = 1.0, mix = 0.5-0.8, all junior = 0.2
 if (seniorRatio >= 0.5) return 1.0;
 if (seniorRatio >= 0.3) return 0.8;
 if (seniorRatio >= 0.2) return 0.6;
 if (midRatio >= 0.5) return 0.5;
 if (juniorRatio >= 0.7) return 0.2;
 return 0.4; // Default for mixed
 }

 /**
 * Calculate tech stack score (0-1)
 * Higher score = matches preferred tech stack
 */
 _calculateTechStackScore(jobPostings, preferredTech = []) {
 if (jobPostings.length === 0) return 0;
 if (preferredTech.length === 0) return 0.5; // Neutral if no preferences

 // Collect all tech mentioned in job postings
 const allTech = new Set();
 jobPostings.forEach(job => {
 if (job.tech_stack && Array.isArray(job.tech_stack)) {
 job.tech_stack.forEach(tech => allTech.add(tech.toLowerCase()));
 }
 });

 // Calculate match ratio
 const matches = preferredTech.filter(tech =>
 allTech.has(tech.toLowerCase())
 ).length;

 return Math.min(1.0, matches / preferredTech.length);
 }

 /**
 * Calculate department signals score (0-1)
 * Higher score = matches preferred departments
 */
 _calculateDepartmentSignals(jobPostings, preferredDepartments = []) {
 if (jobPostings.length === 0) return 0;
 if (preferredDepartments.length === 0) return 0.5; // Neutral if no preferences

 // Count jobs in preferred departments
 const departmentCounts = {};
 jobPostings.forEach(job => {
 const dept = job.department || 'other';
 departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
 });

 // Calculate ratio of jobs in preferred departments
 const totalJobs = jobPostings.length;
 const preferredJobs = preferredDepartments.reduce((sum, dept) => {
 return sum + (departmentCounts[dept] || 0);
 }, 0);

 return preferredJobs / totalJobs;
 }

 /**
 * Calculate company growth score (0-1)
 * Based on headcount, funding stage, and hiring trends
 */
 _calculateCompanyGrowthScore(companyProfile, jobPostings) {
 let score = 0;
 const thresholds = this.companyGrowthThresholds;
 const scores = this.companyGrowthScores;

 // Headcount signal (larger companies = more stable) - using configurable thresholds
 if (companyProfile?.headcount) {
 if (companyProfile.headcount > thresholds.headcountLarge) score += scores.headcountLarge;
 else if (companyProfile.headcount > thresholds.headcountMedium) score += scores.headcountMedium;
 else if (companyProfile.headcount > thresholds.headcountSmall) score += scores.headcountSmall;
 }

 // Funding stage signal - configurable via environment variables
 const fundingScores = {
 seriesC: parseFloat(process.env.LEAD_SCORE_FUNDING_SERIES_C || '0.4'),
 seriesB: parseFloat(process.env.LEAD_SCORE_FUNDING_SERIES_B || '0.3'),
 seriesA: parseFloat(process.env.LEAD_SCORE_FUNDING_SERIES_A || '0.2'),
 seed: parseFloat(process.env.LEAD_SCORE_FUNDING_SEED || '0.1')
 };

 if (companyProfile?.fundingStage) {
 const funding = companyProfile.fundingStage.toLowerCase();
 if (funding.includes('series c') || funding.includes('series d') || funding.includes('growth')) {
 score += fundingScores.seriesC;
 } else if (funding.includes('series b')) {
 score += fundingScores.seriesB;
 } else if (funding.includes('series a')) {
 score += fundingScores.seriesA;
 } else if (funding.includes('seed')) {
 score += fundingScores.seed;
 }
 }

 // Hiring trend signal (more jobs = growing) - using configurable thresholds
 if (jobPostings.length > thresholds.jobsHigh) score += scores.jobsHigh;
 else if (jobPostings.length > thresholds.jobsMedium) score += scores.jobsMedium;
 else if (jobPostings.length > 0) score += scores.jobsLow;

 return Math.min(1.0, score);
 }

 /**
 * Filter companies by ICP criteria
 */
 async filterByICP(criteria, options = {}) {
 try {
 const {
 minScore = 0,
 maxScore = 100,
 departments = [],
 seniority = [],
 techStack = [],
 industries = [],
 headcountMin = null,
 headcountMax = null,
 fundingStages = [],
 hiringVelocityMin = 0
 } = criteria;

 const supabase = getSupabase();
 if (!supabase) {
 throw new Error('Database not available');
 }

 // Get all companies with job postings
 const { data: companies, error } = await supabase
 .from('job_postings')
 .select('company_domain, company_name')
 .not('company_domain', 'is', null);

 if (error) throw error;

 // Get unique companies
 const uniqueCompanies = [...new Map(
 companies.map(c => [c.company_domain, c])
 ).values()];

 // Calculate scores and filter
 const results = [];
 for (const company of uniqueCompanies) {
 const scoreResult = await this.calculateLeadScore(company.company_domain, {
 techStackPreferences: techStack,
 departmentPreferences: departments,
 saveToDatabase: false,
 userId: options.userId
 });

 if (!scoreResult.success) continue;

 const score = scoreResult.score;
 const signals = scoreResult.signals;

 // Apply filters
 if (score < minScore || score > maxScore) continue;
 if (hiringVelocityMin > 0 && signals.hiringVelocity * 100 < hiringVelocityMin) continue;

 // Get company profile for additional filters
 const companyProfile = await this._getCompanyProfile(company.company_domain);

 if (industries.length > 0 && !industries.includes(companyProfile?.industry)) continue;
 if (headcountMin && (!companyProfile?.headcount || companyProfile.headcount < headcountMin)) continue;
 if (headcountMax && companyProfile?.headcount && companyProfile.headcount > headcountMax) continue;
 if (fundingStages.length > 0 && !fundingStages.includes(companyProfile?.fundingStage)) continue;

 results.push({
 companyDomain: company.company_domain,
 companyName: company.company_name || companyProfile?.name,
 score,
 signals,
 companyProfile
 });
 }

 // Sort by score descending
 results.sort((a, b) => b.score - a.score);

 return {
 success: true,
 companies: results,
 count: results.length
 };
 } catch (error) {
 logger.error('Failed to filter by ICP', error, { criteria });
 return {
 success: false,
 error: error.message
 };
 }
 }

 /**
 * Get job postings for a company
 */
 async _getJobPostings(companyDomain) {
 try {
 const supabase = getSupabase();
 if (!supabase) return [];

 const { data, error } = await supabase
 .from('job_postings')
 .select('*')
 .eq('company_domain', companyDomain)
 .eq('scrape_status', 'success')
 .order('posting_date', { ascending: false });

 if (error) {
 logger.warn('Failed to get job postings', { error: error.message, companyDomain });
 return [];
 }

 return data || [];
 } catch (error) {
 logger.error('Error getting job postings', error, { companyDomain });
 return [];
 }
 }

 /**
 * Get company profile
 */
 async _getCompanyProfile(companyDomain) {
 try {
 const enrichmentService = getCompanyEnrichmentService();
 const result = await enrichmentService.enrichCompany(companyDomain, { skipClearbit: true });
 return result.success ? result.data : null;
 } catch (error) {
 logger.error('Error getting company profile', error, { companyDomain });
 return null;
 }
 }

 /**
 * Save lead score to database
 */
 async _saveLeadScore(companyDomain, score, signals, userId) {
 try {
 const supabase = getSupabase();
 if (!supabase) return;

 const { error } = await supabase
 .from('lead_scores')
 .insert({
 company_domain: companyDomain,
 score,
 signals,
 user_id: userId || null
 });

 if (error) {
 logger.warn('Failed to save lead score', { error: error.message, companyDomain });
 }
 } catch (error) {
 logger.error('Error saving lead score', error, { companyDomain });
 }
 }

 /**
 * Batch calculate scores for multiple companies
 */
 async calculateBatchScores(companyDomains, options = {}) {
 const results = [];
 const batchSize = options.batchSize || 10;

 for (let i = 0; i < companyDomains.length; i += batchSize) {
 const batch = companyDomains.slice(i, i + batchSize);
 const batchPromises = batch.map(domain =>
 this.calculateLeadScore(domain, { ...options, saveToDatabase: false })
 );
 const batchResults = await Promise.all(batchPromises);
 results.push(...batchResults);

 // Rate limiting
 if (i + batchSize < companyDomains.length) {
 await new Promise(resolve => setTimeout(resolve, 500));
 }
 }

 // Save all at once if requested
 if (options.saveToDatabase !== false) {
 for (const result of results) {
 if (result.success) {
 await this._saveLeadScore(
 result.companyDomain,
 result.score,
 result.signals,
 options.userId
 );
 }
 }
 }

 return results;
 }
}

// Singleton instance
let scoringInstance = null;

function getLeadScoringService() {
 if (!scoringInstance) {
 scoringInstance = new LeadScoringService();
 }
 return scoringInstance;
}

module.exports = {
 LeadScoringService,
 getLeadScoringService
};

