/**
 * Personalization Service
 * 
 * Generates personalized email content using LLM:
 * - Extract signals from job postings
 * - Generate personalized snippets
 * - Template variable extraction
 * - Playbook templates
 */

const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');
const OpenAI = require('openai');

const logger = createLogger('service.personalization');

class PersonalizationService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY 
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  /**
   * Generate personalized email snippet from job posting
   */
  async generatePersonalizedSnippet(jobPosting, contactInfo, options = {}) {
    try {
      if (!this.openai) {
        return {
          success: false,
          error: 'OpenAI API key not configured'
        };
      }

      const prompt = this._buildPersonalizationPrompt(jobPosting, contactInfo, options);

      const response = await this.openai.chat.completions.create({
        model: options.model || process.env.OPENAI_PERSONALIZATION_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert B2B sales email writer. Generate concise, personalized email snippets (2-3 sentences) that reference specific details from job postings to show you\'ve done research. Be professional, specific, and value-focused.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: parseFloat(process.env.OPENAI_PERSONALIZATION_TEMPERATURE || '0.7'),
        max_tokens: 200
      });

      const snippet = response.choices[0]?.message?.content?.trim();

      if (!snippet) {
        return { success: false, error: 'Failed to generate snippet' };
      }

      return {
        success: true,
        snippet,
        variables: this._extractTemplateVariables(snippet),
        model: options.model || 'gpt-4o-mini'
      };
    } catch (error) {
      logger.error('Failed to generate personalized snippet', error, { 
        jobPostingId: jobPosting?.id 
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build personalization prompt from job posting and contact info
   */
  _buildPersonalizationPrompt(jobPosting, contactInfo, options) {
    const jobTitle = jobPosting.role_title || 'a role';
    const companyName = jobPosting.company_name || contactInfo.companyName || 'your company';
    const department = jobPosting.department || '';
    const techStack = jobPosting.tech_stack || [];
    const location = jobPosting.location || '';
    const contactName = contactInfo.firstName || 'there';
    const contactTitle = contactInfo.title || '';

    let prompt = `Generate a personalized 2-3 sentence email snippet for ${contactName}`;
    
    if (contactTitle) {
      prompt += `, who is ${contactTitle}`;
    }
    
    prompt += ` at ${companyName}. `;
    
    if (department) {
      prompt += `They're hiring in the ${department} department. `;
    }
    
    prompt += `The job posting is for: ${jobTitle}`;
    
    if (location) {
      prompt += ` in ${location}`;
    }
    
    if (techStack.length > 0) {
      prompt += `. They're using: ${techStack.join(', ')}`;
    }
    
    prompt += `. `;
    
    if (options.productContext) {
      prompt += `Our product helps with: ${options.productContext}. `;
    }
    
    prompt += `Write a snippet that shows I've researched their hiring needs and can provide value. Be specific and reference the job posting details.`;

    return prompt;
  }

  /**
   * Extract template variables from text
   */
  _extractTemplateVariables(text) {
    const variables = {};
    
    // Extract common patterns
    const patterns = {
      companyName: /{{company_name}}|{company}|\[COMPANY\]/gi,
      contactName: /{{contact_name}}|{name}|\[NAME\]/gi,
      jobTitle: /{{job_title}}|{role}|\[ROLE\]/gi,
      department: /{{department}}|{dept}|\[DEPT\]/gi
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        variables[key] = true;
      }
    }

    return variables;
  }

  /**
   * Generate personalized email from template
   */
  async generatePersonalizedEmail(template, variables, options = {}) {
    try {
      let email = template;

      // Replace template variables
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}|{${key}}|\\[${key.toUpperCase()}\\]`, 'gi');
        email = email.replace(regex, value || '');
      }

      // Use LLM to enhance if requested
      if (options.enhanceWithLLM && this.openai) {
        const enhanced = await this._enhanceEmailWithLLM(email, variables, options);
        if (enhanced.success) {
          email = enhanced.email;
        }
      }

      return {
        success: true,
        email,
        variablesUsed: Object.keys(variables)
      };
    } catch (error) {
      logger.error('Failed to generate personalized email', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enhance email with LLM
   */
  async _enhanceEmailWithLLM(email, variables, options) {
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email writer. Enhance the provided email to be more engaging and personalized while keeping the same structure and key points.'
          },
          {
            role: 'user',
            content: `Enhance this email:\n\n${email}\n\nContext: ${JSON.stringify(variables)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return {
        success: true,
        email: response.choices[0]?.message?.content?.trim() || email
      };
    } catch (error) {
      logger.warn('LLM enhancement failed, using original', { error: error.message });
      return { success: false, email };
    }
  }

  /**
   * Extract signals from job posting for personalization
   */
  extractSignals(jobPosting) {
    return {
      roleTitle: jobPosting.role_title,
      department: jobPosting.department,
      seniority: jobPosting.seniority,
      techStack: jobPosting.tech_stack || [],
      location: jobPosting.location,
      companyName: jobPosting.company_name,
      postingDate: jobPosting.posting_date,
      description: jobPosting.description ? jobPosting.description.substring(0, 500) : null
    };
  }

  /**
   * Get playbook template
   */
  getPlaybookTemplate(playbookName) {
    const playbooks = {
      'hiring-engineers': {
        name: 'Hiring Engineers Playbook',
        subject: 'Helping {{company_name}} scale their {{department}} team',
        body: `Hi {{contact_name}},

I noticed {{company_name}} is hiring {{job_title}} positions. Based on your job posting mentioning {{tech_stack}}, it looks like you're scaling your {{department}} team.

[Your value proposition here]

Would you be open to a quick 15-minute call to discuss how we've helped similar companies?

Best,
[Your name]`,
        variables: ['company_name', 'contact_name', 'job_title', 'tech_stack', 'department']
      },
      'new-head-of-sales': {
        name: 'New Head of Sales Playbook',
        subject: 'Congrats on the new {{job_title}} role at {{company_name}}',
        body: `Hi {{contact_name}},

Congratulations on joining {{company_name}} as {{job_title}}! I saw the announcement and wanted to reach out.

[Your value proposition for sales leaders]

Would you be interested in learning how we've helped other sales leaders at similar companies?

Best,
[Your name]`,
        variables: ['company_name', 'contact_name', 'job_title']
      },
      'generic': {
        name: 'Generic Outreach Playbook',
        subject: 'Quick question about {{company_name}}\'s {{department}} team',
        body: `Hi {{contact_name}},

I noticed {{company_name}} is hiring for {{job_title}} in {{location}}.

[Your value proposition]

Would you be open to a brief conversation?

Best,
[Your name]`,
        variables: ['company_name', 'contact_name', 'job_title', 'location', 'department']
      }
    };

    return playbooks[playbookName] || playbooks['generic'];
  }
}

// Singleton instance
let personalizationInstance = null;

function getPersonalizationService() {
  if (!personalizationInstance) {
    personalizationInstance = new PersonalizationService();
  }
  return personalizationInstance;
}

module.exports = {
  PersonalizationService,
  getPersonalizationService
};

