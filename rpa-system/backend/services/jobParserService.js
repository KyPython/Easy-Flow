/**
 * Job Parser Service
 *
 * Parses job postings from various ATS (Applicant Tracking System) platforms:
 * - Workday
 * - Greenhouse
 * - Lever
 * - SmartRecruiters
 * - Generic careers pages
 *
 * Features:
 * - ATS vendor auto-detection
 * - Layout change detection
 * - Unified job posting schema
 * - Role standardization (seniority, department, tech stack extraction)
 */

const { createLogger } = require('../middleware/structuredLogging');
const axios = require('axios');
const cheerio = require('cheerio');
const { config } = require('../utils/appConfig');

const logger = createLogger('service.jobParser');

class JobParserService {
  constructor() {
    // ATS vendor detection patterns
    this.atsPatterns = {
      workday: [
        /workday\.com/i,
        /\.myworkdayjobs\.com/i,
        /wd\d+\.myworkdayjobs\.com/i,
        /data-workday-job-id/i,
        /data-automation-id="jobPosting"/i
      ],
      greenhouse: [
        /greenhouse\.io/i,
        /boards\.greenhouse\.io/i,
        /data-job-id/i,
        /data-application-form/i,
        /gh\.io/i
      ],
      lever: [
        /lever\.co/i,
        /jobs\.lever\.co/i,
        /lever\.co\/.*\/jobs/i,
        /data-lever-job-id/i
      ],
      smartrecruiters: [
        /smartrecruiters\.com/i,
        /\.smartrecruiters\.com/i,
        /data-smartrecruiters-job-id/i
      ]
    };

    // Seniority level patterns
    this.seniorityPatterns = {
      intern: /intern|internship|co-op/i,
      junior: /junior|jr\.|entry[- ]level|associate|assistant/i,
      mid: /mid[- ]level|intermediate|experienced/i,
      senior: /senior|sr\.|lead|principal|staff/i,
      executive: /executive|director|vp|vice president|chief|cto|ceo|cfo/i
    };

    // Department patterns
    this.departmentPatterns = {
      engineering: /engineer|software|developer|programmer|devops|sre|backend|frontend|full[- ]stack/i,
      product: /product manager|pm|product owner|product designer/i,
      design: /designer|ux|ui|user experience|visual design/i,
      sales: /sales|account executive|ae|business development|bd|account manager/i,
      marketing: /marketing|growth|content|seo|sem|demand gen/i,
      operations: /operations|ops|business operations|operations manager/i,
      finance: /finance|accounting|controller|cfo|financial analyst/i,
      hr: /hr|human resources|people|talent|recruiting|recruiter/i,
      data: /data|analyst|data scientist|data engineer|analytics|bi/i
    };

    // Tech stack keywords
    this.techStackKeywords = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'ruby', 'php',
      'react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'rails',
      'aws', 'gcp', 'azure', 'kubernetes', 'docker', 'terraform',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'graphql', 'rest', 'microservices', 'serverless'
    ];
  }

  /**
   * Detect ATS vendor from URL or HTML
   */
  detectATSVendor(url, html = '') {
    const urlLower = url.toLowerCase();
    const htmlLower = html.toLowerCase();

    for (const [vendor, patterns] of Object.entries(this.atsPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(urlLower) || pattern.test(htmlLower)) {
          logger.debug('ATS vendor detected', { vendor, url });
          return vendor;
        }
      }
    }

    return 'generic';
  }

  /**
   * Parse job posting from HTML
   */
  async parseJobPosting(url, html, atsVendor = null) {
    try {
      // Auto-detect ATS vendor if not provided
      if (!atsVendor) {
        atsVendor = this.detectATSVendor(url, html);
      }

      logger.info('Parsing job posting', { url, atsVendor });

      let parsedData;

      // Use vendor-specific parser if available
      switch (atsVendor) {
        case 'workday':
          parsedData = this._parseWorkday(html, url);
          break;
        case 'greenhouse':
          parsedData = this._parseGreenhouse(html, url);
          break;
        case 'lever':
          parsedData = this._parseLever(html, url);
          break;
        case 'smartrecruiters':
          parsedData = this._parseSmartRecruiters(html, url);
          break;
        default:
          parsedData = this._parseGeneric(html, url);
      }

      // Normalize and enrich the data
      const normalized = this._normalizeJobPosting(parsedData, atsVendor);

      return {
        success: true,
        atsVendor,
        rawData: parsedData,
        normalizedData: normalized
      };
    } catch (error) {
      logger.error('Failed to parse job posting', error, { url, atsVendor });
      return {
        success: false,
        error: error.message,
        atsVendor: atsVendor || 'unknown'
      };
    }
  }

  /**
   * Parse Workday job posting
   */
  _parseWorkday(html, url) {
    const $ = cheerio.load(html);
    const data = {};

    // Workday-specific selectors
    data.roleTitle = $('h2[data-automation-id="jobPostingHeader"]').text().trim() ||
                     $('.jobTitle').text().trim() ||
                     $('h1').first().text().trim();

    data.location = $('[data-automation-id="jobPostingHeader"] .jobLocation').text().trim() ||
                    $('.jobLocation').text().trim() ||
                    $('[data-automation-id="locations"]').text().trim();

    data.description = $('[data-automation-id="jobPostingDescription"]').text().trim() ||
                       $('.jobDescription').text().trim() ||
                       $('[data-automation-id="jobPosting"]').text().trim();

    // Extract salary if available
    const salaryText = $('[data-automation-id="compensation"]').text() ||
                       $('.compensation').text();
    data.salaryRange = this._extractSalary(salaryText);

    // Extract posting date
    data.postingDate = this._extractDate($('[data-automation-id="postedOn"]').text() ||
                                         $('.postedDate').text());

    // Extract company name
    data.companyName = $('[data-automation-id="jobPostingHeader"] .companyName').text().trim() ||
                       $('.companyName').text().trim();

    data.sourceUrl = url;

    return data;
  }

  /**
   * Parse Greenhouse job posting
   */
  _parseGreenhouse(html, url) {
    const $ = cheerio.load(html);
    const data = {};

    // Greenhouse-specific selectors
    data.roleTitle = $('h1.app-title').text().trim() ||
                     $('.job-title').text().trim() ||
                     $('h1').first().text().trim();

    data.location = $('.location').text().trim() ||
                    $('[data-testid="location"]').text().trim();

    data.description = $('.content').text().trim() ||
                       $('.job-description').text().trim() ||
                       $('#content').text().trim();

    // Extract salary
    const salaryText = $('.salary').text() || $('[data-testid="salary"]').text();
    data.salaryRange = this._extractSalary(salaryText);

    // Extract posting date
    data.postingDate = this._extractDate($('.posted-date').text() ||
                                         $('[data-testid="posted-date"]').text());

    // Extract company name from URL or page
    data.companyName = $('.company-name').text().trim() ||
                       $('meta[property="og:site_name"]').attr('content') ||
                       // eslint-disable-next-line no-useless-escape
                      url.match(/boards\.greenhouse\.io\/([^\/]+)/)?.[1];

    data.sourceUrl = url;

    return data;
  }

  /**
   * Parse Lever job posting
   */
  _parseLever(html, url) {
    const $ = cheerio.load(html);
    const data = {};

    // Lever-specific selectors
    data.roleTitle = $('.posting-headline h2').text().trim() ||
                     $('.posting-title').text().trim() ||
                     $('h1').first().text().trim();

    data.location = $('.posting-category').text().trim() ||
                    $('.location').text().trim();

    data.description = $('.content').text().trim() ||
                       $('.posting-description').text().trim() ||
                       $('.section-wrapper').text().trim();

    // Extract salary
    const salaryText = $('.salary').text();
    data.salaryRange = this._extractSalary(salaryText);

    // Extract posting date
    data.postingDate = this._extractDate($('.posted-date').text());

    // Extract company name from URL
    // eslint-disable-next-line no-useless-escape
    const urlMatch = url.match(/jobs\.lever\.co\/([^\/]+)/);
    data.companyName = urlMatch ? urlMatch[1] : $('.company-name').text().trim();

    data.sourceUrl = url;

    return data;
  }

  /**
   * Parse SmartRecruiters job posting
   */
  _parseSmartRecruiters(html, url) {
    const $ = cheerio.load(html);
    const data = {};

    // SmartRecruiters-specific selectors
    data.roleTitle = $('.job-title').text().trim() ||
                     $('h1').first().text().trim();

    data.location = $('.job-location').text().trim() ||
                    $('.location').text().trim();

    data.description = $('.job-description').text().trim() ||
                       $('.description').text().trim();

    data.salaryRange = this._extractSalary($('.salary').text());
    data.postingDate = this._extractDate($('.posted-date').text());
    data.companyName = $('.company-name').text().trim() ||
                       $('meta[property="og:site_name"]').attr('content');

    data.sourceUrl = url;

    return data;
  }

  /**
   * Parse generic careers page
   */
  _parseGeneric(html, url) {
    const $ = cheerio.load(html);
    const data = {};

    // Try common selectors
    data.roleTitle = $('h1').first().text().trim() ||
                     $('.job-title').text().trim() ||
                     $('[class*="job"][class*="title"]').first().text().trim();

    data.location = $('.location').text().trim() ||
                    $('[class*="location"]').first().text().trim() ||
                    $('[data-location]').attr('data-location');

    data.description = $('.job-description').text().trim() ||
                       $('.description').text().trim() ||
                       $('main').text().trim() ||
                       $('article').text().trim();

    // Try to extract from meta tags
    if (!data.roleTitle) {
      data.roleTitle = $('meta[property="og:title"]').attr('content') ||
                       $('title').text().trim();
    }

    if (!data.companyName) {
      data.companyName = $('meta[property="og:site_name"]').attr('content') ||
                         $('.company-name').text().trim();
    }

    data.salaryRange = this._extractSalary($('.salary, [class*="salary"]').text());
    data.postingDate = this._extractDate($('.posted-date, [class*="date"]').text());
    data.sourceUrl = url;

    return data;
  }

  /**
   * Normalize job posting data to unified schema
   */
  _normalizeJobPosting(rawData, atsVendor) {
    const normalized = {
      roleTitle: this._normalizeText(rawData.roleTitle),
      location: this._normalizeText(rawData.location),
      description: this._normalizeText(rawData.description),
      salaryRange: rawData.salaryRange || null,
      postingDate: rawData.postingDate || null,
      companyName: this._normalizeText(rawData.companyName),
      sourceUrl: rawData.sourceUrl,
      atsVendor,
      seniority: this._extractSeniority(rawData.roleTitle, rawData.description),
      department: this._extractDepartment(rawData.roleTitle, rawData.description),
      techStack: this._extractTechStack(rawData.description)
    };

    return normalized;
  }

  /**
   * Extract seniority level from title and description
   */
  _extractSeniority(title = '', description = '') {
    const text = `${title} ${description}`.toLowerCase();

    for (const [level, pattern] of Object.entries(this.seniorityPatterns)) {
      if (pattern.test(text)) {
        return level;
      }
    }

    return 'mid'; // Default to mid-level if not detected
  }

  /**
   * Extract department from title and description
   */
  _extractDepartment(title = '', description = '') {
    const text = `${title} ${description}`.toLowerCase();

    for (const [dept, pattern] of Object.entries(this.departmentPatterns)) {
      if (pattern.test(text)) {
        return dept;
      }
    }

    return 'other';
  }

  /**
   * Extract tech stack from description
   */
  _extractTechStack(description = '') {
    if (!description) return [];

    const descLower = description.toLowerCase();
    const found = [];

    for (const tech of this.techStackKeywords) {
      if (descLower.includes(tech)) {
        found.push(tech);
      }
    }

    return found;
  }

  /**
   * Extract salary range from text
   */
  _extractSalary(text) {
    if (!text) return null;

    // Patterns: $100k-$150k, $100,000 - $150,000, 100k-150k
    const patterns = [
      /\$?(\d+(?:,\d{3})*(?:k|K)?)\s*[-–—]\s*\$?(\d+(?:,\d{3})*(?:k|K)?)/,
      /\$(\d+(?:,\d{3})*)\s*to\s*\$(\d+(?:,\d{3})*)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return `${match[1]}-${match[2]}`;
      }
    }

    return null;
  }

  /**
   * Extract date from text
   */
  _extractDate(text) {
    if (!text) return null;

    // Try to parse common date formats
    const date = new Date(text);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    return null;
  }

  /**
   * Normalize text (trim, clean whitespace)
   */
  _normalizeText(text) {
    if (!text) return null;
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Parse multiple job postings from a careers page
   */
  async parseCareersPage(url, html) {
    try {
      const $ = cheerio.load(html);
      const jobs = [];

      // Try to find job listing containers (common patterns)
      const jobSelectors = [
        '.job-listing',
        '.job-item',
        '[data-job-id]',
        '.careers-job',
        'article.job',
        '.position'
      ];

      let jobElements = $();
      for (const selector of jobSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          jobElements = elements;
          break;
        }
      }

      // If no specific job containers found, try to find links to job postings
      if (jobElements.length === 0) {
        jobElements = $('a[href*="/job"], a[href*="/careers"], a[href*="/position"]');
      }

      for (let i = 0; i < Math.min(jobElements.length, 50); i++) {
        const element = jobElements.eq(i);
        const jobUrl = element.attr('href') || element.find('a').attr('href');

        if (jobUrl) {
          const fullUrl = jobUrl.startsWith('http') ? jobUrl : new URL(jobUrl, url).href;

          const jobData = {
            roleTitle: element.find('h2, h3, .title, .job-title').first().text().trim() ||
                       element.text().trim().split('\n')[0],
            location: element.find('.location, [class*="location"]').text().trim(),
            sourceUrl: fullUrl,
            atsVendor: this.detectATSVendor(fullUrl, element.html())
          };

          if (jobData.roleTitle) {
            jobs.push(jobData);
          }
        }
      }

      logger.info('Parsed careers page', { url, jobsFound: jobs.length });

      return {
        success: true,
        jobs,
        totalFound: jobs.length
      };
    } catch (error) {
      logger.error('Failed to parse careers page', error, { url });
      return {
        success: false,
        error: error.message,
        jobs: []
      };
    }
  }
}

// Singleton instance
let jobParserInstance = null;

function getJobParserService() {
  if (!jobParserInstance) {
    jobParserInstance = new JobParserService();
  }
  return jobParserInstance;
}

module.exports = {
  JobParserService,
  getJobParserService
};

