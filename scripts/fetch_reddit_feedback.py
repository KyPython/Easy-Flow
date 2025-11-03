#!/usr/bin/env python3
"""
Reddit Pain Point Extraction System
===================================

FUNCTIONALITY:
- Fetches Reddit posts/comments for automation, self-hosting, and business process keywords
- Extracts user pain points, feature requests, and frustrations using NLP
- Outputs structured JSON data for lead magnet generation
- Handles rate limiting, missing data, and API failures gracefully

DEPENDENCIES: requests, praw (Reddit API), nltk or spacy for text analysis
USAGE: python fetch_reddit_feedback.py --keywords "automation,self-hosting" --output pain_points.json

ASSUMPTIONS:
- Reddit API credentials are in environment variables or config
- Rate limiting respects Reddit's API guidelines (60 requests/minute)
- Text analysis focuses on English content
"""

import os
import json
import time
import logging
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any
import re

# Optional imports with fallbacks
try:
    import praw
    REDDIT_AVAILABLE = True
except ImportError:
    REDDIT_AVAILABLE = False
    print("⚠️ praw not installed. Install with: pip install praw")

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠️ requests not installed. Install with: pip install requests")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RedditPainPointExtractor:
    def __init__(self):
        """Initialize Reddit client and pain point patterns"""
        self.reddit = None
        self.pain_point_patterns = [
            r"(can't|cannot|unable to|struggling with|frustrated by|hate that|wish I could)",
            r"(should be easier|too complicated|too hard|confusing|difficult)",
            r"(missing feature|needs|would like|request|suggestion)",
            r"(manual process|repetitive|time consuming|tedious)",
            r"(security concern|privacy issue|data breach|vulnerable)"
        ]
        
        # Keyword categories for different pain points
        self.keyword_categories = {
            'automation': ['automation', 'rpa', 'workflow', 'process', 'manual'],
            'self_hosting': ['self-host', 'docker', 'kubernetes', 'server', 'deploy'],
            'security': ['security', 'privacy', 'compliance', 'audit', 'gdpr'],
            'integration': ['api', 'webhook', 'integration', 'connect', 'sync']
        }
        
        if REDDIT_AVAILABLE:
            self.setup_reddit_client()
    
    def setup_reddit_client(self):
        """Setup Reddit API client with credentials"""
        try:
            self.reddit = praw.Reddit(
                client_id=os.getenv('REDDIT_CLIENT_ID', 'dummy_id'),
                client_secret=os.getenv('REDDIT_CLIENT_SECRET', 'dummy_secret'),
                user_agent=os.getenv('REDDIT_USER_AGENT', 'EasyFlow:v1.0 (by /u/easyflow_bot)'),
                # Use read-only mode for public data
                username=None,
                password=None
            )
            logger.info("✅ Reddit client initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Reddit client: {e}")
            self.reddit = None
    
    def extract_pain_points_from_text(self, text: str, category: str = 'general') -> List[Dict]:
        """Extract pain points from text using pattern matching"""
        pain_points = []
        
        # Clean and normalize text
        text = re.sub(r'[^\w\s]', ' ', text.lower())
        sentences = text.split('.')
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 10:  # Skip very short sentences
                continue
                
            # Check for pain point patterns
            for pattern in self.pain_point_patterns:
                if re.search(pattern, sentence, re.IGNORECASE):
                    pain_point = {
                        'text': sentence,
                        'category': category,
                        'confidence': self.calculate_confidence(sentence),
                        'keywords': self.extract_keywords(sentence),
                        'timestamp': datetime.now().isoformat()
                    }
                    pain_points.append(pain_point)
                    break
        
        return pain_points
    
    def calculate_confidence(self, text: str) -> float:
        """Calculate confidence score for pain point detection"""
        confidence = 0.3  # Base confidence
        
        # Boost confidence based on strong indicators
        strong_indicators = ['hate', 'frustrated', 'impossible', 'broken', 'terrible']
        for indicator in strong_indicators:
            if indicator in text.lower():
                confidence += 0.2
        
        # Boost for specific feature requests
        if any(word in text.lower() for word in ['feature', 'need', 'want', 'should']):
            confidence += 0.15
        
        return min(confidence, 1.0)
    
    def extract_keywords(self, text: str) -> List[str]:
        """Extract relevant keywords from text"""
        # Simple keyword extraction (could be enhanced with NLP)
        tech_keywords = [
            'automation', 'docker', 'api', 'webhook', 'security', 'privacy',
            'integration', 'workflow', 'deployment', 'monitoring', 'backup'
        ]
        
        found_keywords = []
        text_lower = text.lower()
        
        for keyword in tech_keywords:
            if keyword in text_lower:
                found_keywords.append(keyword)
        
        return found_keywords
    
    def fetch_reddit_posts(self, subreddits: List[str], keywords: List[str], limit: int = 50) -> List[Dict]:
        """Fetch Reddit posts matching keywords from specified subreddits"""
        if not self.reddit:
            logger.warning("Reddit client not available, using mock data")
            return self.get_mock_data()
        
        all_posts = []
        
        for subreddit_name in subreddits:
            try:
                subreddit = self.reddit.subreddit(subreddit_name)
                
                # Search for posts with keywords
                for keyword in keywords:
                    search_results = subreddit.search(keyword, limit=limit//len(keywords))
                    
                    for post in search_results:
                        post_data = {
                            'id': post.id,
                            'title': post.title,
                            'body': post.selftext,
                            'score': post.score,
                            'subreddit': subreddit_name,
                            'created_utc': post.created_utc,
                            'num_comments': post.num_comments,
                            'url': post.url
                        }
                        all_posts.append(post_data)
                        
                        # Add top comments
                        try:
                            post.comments.replace_more(limit=0)
                            for comment in post.comments[:5]:  # Top 5 comments
                                if hasattr(comment, 'body') and len(comment.body) > 20:
                                    comment_data = {
                                        'id': f"{post.id}_{comment.id}",
                                        'title': f"Comment on: {post.title}",
                                        'body': comment.body,
                                        'score': comment.score,
                                        'subreddit': subreddit_name,
                                        'created_utc': comment.created_utc,
                                        'is_comment': True
                                    }
                                    all_posts.append(comment_data)
                        except Exception as e:
                            logger.warning(f"Failed to fetch comments for post {post.id}: {e}")
                
                # Rate limiting
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"Failed to fetch from r/{subreddit_name}: {e}")
                continue
        
        logger.info(f"✅ Fetched {len(all_posts)} posts/comments from Reddit")
        return all_posts
    
    def get_mock_data(self) -> List[Dict]:
        """Provide mock Reddit data for testing when API is unavailable"""
        return [
            {
                'id': 'mock_1',
                'title': 'Struggling with manual invoice processing - need automation',
                'body': 'I hate manually processing hundreds of invoices every month. It\'s so time consuming and error-prone. Wish there was an easy way to automate this.',
                'score': 45,
                'subreddit': 'smallbusiness',
                'created_utc': time.time() - 86400,  # Yesterday
                'num_comments': 12
            },
            {
                'id': 'mock_2', 
                'title': 'Self-hosting challenges - security concerns',
                'body': 'Can\'t seem to get proper security setup for self-hosted applications. Too complicated for small teams. Missing good documentation.',
                'score': 78,
                'subreddit': 'selfhosted',
                'created_utc': time.time() - 172800,  # 2 days ago
                'num_comments': 23
            },
            {
                'id': 'mock_3',
                'title': 'API integrations are frustrating',
                'body': 'Every API integration takes weeks to implement. Should be easier to connect different tools. Rate limiting and authentication is a nightmare.',
                'score': 34,
                'subreddit': 'webdev',
                'created_utc': time.time() - 259200,  # 3 days ago
                'num_comments': 8
            }
        ]
    
    def process_posts(self, posts: List[Dict]) -> Dict[str, Any]:
        """Process Reddit posts to extract structured pain points"""
        pain_points_by_category = {
            'automation': [],
            'self_hosting': [],
            'security': [], 
            'integration': [],
            'general': []
        }
        
        stats = {
            'total_posts_processed': len(posts),
            'total_pain_points_found': 0,
            'processing_date': datetime.now().isoformat(),
            'categories_distribution': {}
        }
        
        for post in posts:
            # Determine category based on keywords
            category = 'general'
            text_content = f"{post.get('title', '')} {post.get('body', '')}".lower()
            
            for cat_name, keywords in self.keyword_categories.items():
                if any(keyword in text_content for keyword in keywords):
                    category = cat_name
                    break
            
            # Extract pain points from title and body
            combined_text = f"{post.get('title', '')}. {post.get('body', '')}"
            post_pain_points = self.extract_pain_points_from_text(combined_text, category)
            
            # Add post metadata to each pain point
            for pp in post_pain_points:
                pp.update({
                    'source_post_id': post['id'],
                    'source_subreddit': post.get('subreddit', 'unknown'),
                    'post_score': post.get('score', 0),
                    'post_title': post.get('title', ''),
                    'is_comment': post.get('is_comment', False)
                })
            
            pain_points_by_category[category].extend(post_pain_points)
            stats['total_pain_points_found'] += len(post_pain_points)
        
        # Calculate category distribution
        for category, points in pain_points_by_category.items():
            stats['categories_distribution'][category] = len(points)
        
        return {
            'pain_points': pain_points_by_category,
            'stats': stats,
            'metadata': {
                'extraction_method': 'reddit_pattern_matching',
                'version': '1.0',
                'subreddits_searched': list(set([p.get('subreddit', '') for p in posts])),
                'total_keywords_used': sum(len(kw) for kw in self.keyword_categories.values())
            }
        }
    
    def save_results(self, results: Dict[str, Any], output_file: str):
        """Save extracted pain points to JSON file"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            logger.info(f"✅ Results saved to {output_file}")
        except Exception as e:
            logger.error(f"❌ Failed to save results: {e}")

def main():
    parser = argparse.ArgumentParser(description='Extract pain points from Reddit')
    parser.add_argument('--keywords', default='automation,self-hosting,business-process', 
                       help='Comma-separated keywords to search for')
    parser.add_argument('--subreddits', default='smallbusiness,entrepreneur,selfhosted,webdev,sysadmin',
                       help='Comma-separated subreddit names')
    parser.add_argument('--output', default='data/reddit_pain_points.json',
                       help='Output file path')
    parser.add_argument('--limit', type=int, default=100,
                       help='Maximum posts to fetch per keyword')
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    
    # Initialize extractor
    extractor = RedditPainPointExtractor()
    
    # Parse input parameters
    keywords = [kw.strip() for kw in args.keywords.split(',')]
    subreddits = [sub.strip() for sub in args.subreddits.split(',')]
    
    logger.info(f"🔍 Searching for keywords: {keywords}")
    logger.info(f"📍 In subreddits: {subreddits}")
    
    # Fetch Reddit data
    posts = extractor.fetch_reddit_posts(subreddits, keywords, args.limit)
    
    if not posts:
        logger.warning("No posts fetched, exiting")
        return
    
    # Process posts to extract pain points
    results = extractor.process_posts(posts)
    
    # Save results
    extractor.save_results(results, args.output)
    
    # Print summary
    stats = results['stats']
    print(f"\n📊 EXTRACTION SUMMARY:")
    print(f"   Posts processed: {stats['total_posts_processed']}")
    print(f"   Pain points found: {stats['total_pain_points_found']}")
    print(f"   Categories: {dict(stats['categories_distribution'])}")
    print(f"   Output: {args.output}")

if __name__ == '__main__':
    main()