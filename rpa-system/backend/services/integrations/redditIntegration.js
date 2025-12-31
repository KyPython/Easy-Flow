/**
 * Reddit Integration Service
 * Provides Reddit monitoring, keyword tracking, thread extraction, and insight generation
 */

const axios = require('axios');
const { logger } = require('../../utils/logger');

class RedditIntegration {
  constructor() {
    this.logger = logger.withOperation('integration.reddit');
  }

  /**
   * Search Reddit for posts matching keywords
   * Uses Reddit's public JSON API (no auth required for public data)
   */
  async searchPosts(keywords, subreddits = [], limit = 25) {
    try {
      const results = [];
      
      // If subreddits specified, search each one; otherwise search all of Reddit
      const searchTargets = subreddits.length > 0 
        ? subreddits 
        : ['all']; // Search all of Reddit

      for (const subreddit of searchTargets) {
        for (const keyword of keywords) {
          try {
            // Reddit JSON API: https://www.reddit.com/r/subreddit/search.json?q=keyword&limit=25
            const url = `https://www.reddit.com/r/${subreddit}/search.json`;
            const response = await axios.get(url, {
              params: {
                q: keyword,
                limit: limit,
                sort: 'relevance',
                restrict_sr: subreddit !== 'all' ? 'true' : 'false'
              },
              headers: {
                'User-Agent': 'EasyFlow/1.0 (Automation Platform)'
              }
            });

            if (response.data?.data?.children) {
              const posts = response.data.data.children.map(child => ({
                id: child.data.id,
                title: child.data.title,
                author: child.data.author,
                subreddit: child.data.subreddit,
                url: child.data.url,
                permalink: `https://reddit.com${child.data.permalink}`,
                selftext: child.data.selftext || '',
                score: child.data.score,
                num_comments: child.data.num_comments,
                created_utc: child.data.created_utc,
                keyword: keyword
              }));

              results.push(...posts);
            }

            // Rate limiting: Reddit allows 60 requests per minute
            await new Promise(resolve => setTimeout(resolve, 1100));
          } catch (error) {
            this.logger.warn(`Failed to search ${subreddit} for "${keyword}"`, {
              error: error.message,
              status: error.response?.status
            });
          }
        }
      }

      // Remove duplicates based on post ID
      const uniquePosts = Array.from(
        new Map(results.map(post => [post.id, post])).values()
      );

      this.logger.info('Reddit search completed', {
        keywords: keywords.length,
        subreddits: searchTargets.length,
        postsFound: uniquePosts.length
      });

      return {
        success: true,
        posts: uniquePosts,
        count: uniquePosts.length
      };
    } catch (error) {
      this.logger.error('Reddit search failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get comments for a Reddit post
   */
  async getPostComments(postPermalink) {
    try {
      // Remove leading slash if present and ensure .json extension
      const permalink = postPermalink.startsWith('/') 
        ? postPermalink.substring(1) 
        : postPermalink;
      const url = `https://www.reddit.com/${permalink}.json`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'EasyFlow/1.0 (Automation Platform)'
        }
      });

      if (response.data && response.data.length > 0) {
        const postData = response.data[0].data.children[0].data;
        const comments = response.data[1]?.data?.children || [];

        const extractedComments = comments
          .filter(child => child.kind === 't1') // t1 = comment
          .map(child => ({
            id: child.data.id,
            author: child.data.author,
            body: child.data.body,
            score: child.data.score,
            created_utc: child.data.created_utc,
            permalink: `https://reddit.com${child.data.permalink}`
          }));

        return {
          success: true,
          post: {
            id: postData.id,
            title: postData.title,
            selftext: postData.selftext || '',
            url: postData.url,
            permalink: `https://reddit.com${postData.permalink}`
          },
          comments: extractedComments,
          commentCount: extractedComments.length
        };
      }

      return { success: false, error: 'No data returned' };
    } catch (error) {
      this.logger.error('Failed to get Reddit comments', {
        error: error.message,
        permalink: postPermalink
      });
      throw error;
    }
  }

  /**
   * Analyze sentiment and classify topic using AI
   */
  async analyzeContent(content, context = {}) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Analyze the following Reddit content and provide:
1. Sentiment: positive, negative, or neutral
2. Topic category: product_feature, bug_report, pricing, competitor_comparison, feature_request, support_question, praise, complaint, or other
3. Key insights: What users like, dislike, or want changed
4. Relevance score: 0-100 (how relevant is this to product/marketing/sales/support)

Content: ${content.title || ''}\n\n${content.selftext || content.body || ''}

${context.businessContext ? `Business Context: ${context.businessContext}` : ''}

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral",
  "topic": "category_name",
  "relevance_score": 0-100,
  "insights": {
    "likes": ["what users like"],
    "dislikes": ["what users dislike"],
    "requests": ["what users want changed"],
    "competitor_mentions": ["competitor names mentioned"],
    "feature_comparisons": ["feature comparisons made"]
  },
  "summary": "brief summary",
  "applicable_teams": ["product", "marketing", "sales", "support"]
}`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing Reddit content for business insights. Provide accurate, structured analysis in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);

      return {
        success: true,
        analysis
      };
    } catch (error) {
      this.logger.error('Content analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate insights for different teams (product, marketing, sales, support)
   */
  async generateInsights(analyses, businessContext = {}) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const insightsByTeam = {
        product: [],
        marketing: [],
        sales: [],
        support: []
      };

      // Group analyses by applicable teams
      for (const analysis of analyses) {
        if (analysis.analysis?.applicable_teams) {
          for (const team of analysis.analysis.applicable_teams) {
            if (insightsByTeam[team]) {
              insightsByTeam[team].push({
                content: analysis.content,
                analysis: analysis.analysis,
                post: analysis.post
              });
            }
          }
        }
      }

      // Generate team-specific insights using AI
      const generatedInsights = {};

      for (const [team, relevantAnalyses] of Object.entries(insightsByTeam)) {
        if (relevantAnalyses.length === 0) continue;

        const prompt = `Generate ${team} team insights from the following Reddit discussions:

${relevantAnalyses.map(a => `
Title: ${a.post?.title || a.content.title}
Content: ${a.content.selftext || a.content.body || ''}
Sentiment: ${a.analysis.sentiment}
Topic: ${a.analysis.topic}
Key Points: ${a.analysis.summary}
`).join('\n---\n')}

Business Context: ${businessContext[team] || 'No specific context provided'}

Generate actionable insights for the ${team} team:
- What trends do you see?
- What should they prioritize?
- What competitive advantages or disadvantages are mentioned?
- What objections or concerns do users have?
- What content angles or messaging opportunities exist?

Respond in JSON format:
{
  "trends": ["trend 1", "trend 2"],
  "priorities": ["priority 1", "priority 2"],
  "competitive_insights": ["insight 1"],
  "objections": ["objection 1"],
  "content_angles": ["angle 1"],
  "summary": "overall summary for ${team} team"
}`;

        try {
          const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            messages: [
              {
                role: 'system',
                content: `You are an expert ${team} strategist analyzing Reddit discussions for actionable insights.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' }
          });

          generatedInsights[team] = JSON.parse(completion.choices[0].message.content);
        } catch (error) {
          this.logger.warn(`Failed to generate ${team} insights`, { error: error.message });
          generatedInsights[team] = {
            summary: `Analysis of ${relevantAnalyses.length} relevant discussions`,
            trends: [],
            priorities: []
          };
        }
      }

      return {
        success: true,
        insights: generatedInsights,
        summary: {
          total_posts: analyses.length,
          by_team: Object.keys(generatedInsights).length,
          by_sentiment: {
            positive: analyses.filter(a => a.analysis?.sentiment === 'positive').length,
            negative: analyses.filter(a => a.analysis?.sentiment === 'negative').length,
            neutral: analyses.filter(a => a.analysis?.sentiment === 'neutral').length
          }
        }
      };
    } catch (error) {
      this.logger.error('Insight generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Test Reddit API connection (no auth needed - public API)
   */
  async testConnection() {
    try {
      // Simple test: search for a common term
      const response = await axios.get('https://www.reddit.com/r/all/search.json', {
        params: {
          q: 'test',
          limit: 1
        },
        headers: {
          'User-Agent': 'EasyFlow/1.0 (Automation Platform)'
        }
      });

      if (response.data?.data) {
        return {
          success: true,
          message: 'Reddit API is accessible'
        };
      }

      return {
        success: false,
        message: 'Reddit API returned unexpected format'
      };
    } catch (error) {
      this.logger.error('Reddit connection test failed', { error: error.message });
      return {
        success: false,
        message: `Reddit API test failed: ${error.message}`
      };
    }
  }

  /**
   * Generate blog topic suggestions from Reddit discussions
   */
  async generateBlogTopics(insights, count = 5) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Based on these Reddit discussion insights, generate ${count} compelling blog post topics:

${JSON.stringify(insights, null, 2)}

Generate topics that:
1. Address common questions or pain points mentioned
2. Provide value to the Reddit community
3. Are SEO-friendly and searchable
4. Can be written from your expertise

Respond in JSON format:
{
  "topics": [
    {
      "title": "Blog post title",
      "angle": "unique angle or perspective",
      "target_keywords": ["keyword1", "keyword2"],
      "why_relevant": "why this topic matters based on discussions"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content strategist who creates blog topics based on community discussions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0].message.content);

      return {
        success: true,
        topics: result.topics || []
      };
    } catch (error) {
      this.logger.error('Blog topic generation failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new RedditIntegration();

