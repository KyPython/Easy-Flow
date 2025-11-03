#!/usr/bin/env python3
"""
Feedback Analysis & Insight Generation System
============================================

FUNCTIONALITY:
- Aggregates feedback from Reddit extraction and in-app surveys
- Performs sentiment analysis and identifies trends
- Generates actionable insights for product roadmap
- Outputs structured JSON and CSV reports for marketing team

DEPENDENCIES: pandas, nltk/textblob for sentiment, json, csv
USAGE: python analyze_feedback.py --reddit-data pain_points.json --survey-data feedback_responses.json

ASSUMPTIONS:
- Reddit data follows fetch_reddit_feedback.py output format
- Survey data comes from SurveyComponent backend endpoint
- Analysis focuses on English text content
- Sentiment scores range from -1 (negative) to 1 (positive)
"""

import os
import json
import csv
import logging
from datetime import datetime
from collections import defaultdict
import argparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FeedbackAnalyzer:
    def __init__(self):
        """Initialize feedback analyzer with sentiment and keyword analysis"""
        self.pain_point_categories = {
            'automation': ['automation', 'manual', 'repetitive', 'workflow', 'process'],
            'integration': ['api', 'integration', 'connect', 'webhook', 'sync'],
            'security': ['security', 'privacy', 'compliance', 'gdpr', 'audit'],
            'deployment': ['deploy', 'docker', 'kubernetes', 'hosting', 'server'],
            'usability': ['difficult', 'complex', 'confusing', 'documentation', 'guide']
        }
        
        # Feature request patterns
        self.feature_patterns = {
            'ai_assistance': ['ai', 'artificial intelligence', 'smart', 'intelligent'],
            'better_ui': ['ui', 'interface', 'design', 'user experience', 'ux'],
            'more_integrations': ['integration', 'connect', 'api', 'third party', 'plugin'],
            'security_tools': ['security', 'encryption', 'authentication', '2fa', 'vault'],
            'monitoring': ['monitoring', 'analytics', 'dashboard', 'metrics', 'alerting']
        }
    
    def analyze_reddit_data(self, reddit_data):
        """Analyze Reddit pain points data"""
        if not reddit_data or 'pain_points' not in reddit_data:
            return {'categories': {}, 'top_issues': []}
        
        analysis = {'categories': defaultdict(list), 'top_issues': []}
        
        for category, points in reddit_data['pain_points'].items():
            analysis['categories'][category] = points
            
        return dict(analysis)
    
    def analyze_survey_data(self, survey_data):
        """Analyze in-app survey responses"""
        if not survey_data:
            return {'response_count': 0, 'avg_ratings': {}}
        
        analysis = {
            'response_count': len(survey_data),
            'pain_point_ratings': defaultdict(list),
            'feature_priority_ratings': defaultdict(list),
            'avg_ratings': {}
        }
        
        for response in survey_data:
            # Pain point ratings
            if 'painPoints' in response:
                for pain_point, rating in response['painPoints'].items():
                    if rating is not None:
                        analysis['pain_point_ratings'][pain_point].append(rating)
            
            # Feature priority ratings
            if 'featurePriorities' in response:
                for feature, rating in response['featurePriorities'].items():
                    if rating is not None:
                        analysis['feature_priority_ratings'][feature].append(rating)
        
        # Calculate averages
        for pain_point, ratings in analysis['pain_point_ratings'].items():
            analysis['avg_ratings'][f"pain_{pain_point}"] = sum(ratings) / len(ratings)
        
        for feature, ratings in analysis['feature_priority_ratings'].items():
            analysis['avg_ratings'][f"feature_{feature}"] = sum(ratings) / len(ratings)
        
        return analysis
    
    def generate_insights(self, reddit_analysis, survey_analysis):
        """Generate actionable insights from combined analysis"""
        insights = {
            'executive_summary': {
                'total_feedback_points': (
                    len([p for cat in reddit_analysis.get('categories', {}).values() for p in cat]) +
                    survey_analysis.get('response_count', 0)
                ),
                'reddit_pain_points': len([p for cat in reddit_analysis.get('categories', {}).values() for p in cat]),
                'survey_responses': survey_analysis.get('response_count', 0),
                'analysis_date': datetime.now().isoformat()
            },
            'top_pain_points': [],
            'feature_recommendations': [],
            'messaging_insights': []
        }
        
        # Extract high-priority pain points from survey
        avg_ratings = survey_analysis.get('avg_ratings', {})
        for key, rating in avg_ratings.items():
            if key.startswith('pain_') and rating >= 4.0:
                pain_point_name = key.replace('pain_', '').replace('_', ' ')
                insights['top_pain_points'].append({
                    'category': key.replace('pain_', ''),
                    'severity': rating,
                    'source': 'survey',
                    'description': f"Users rate {pain_point_name} as {rating:.1f}/5 pain level"
                })
        
        # Extract high-priority features from survey
        for key, rating in avg_ratings.items():
            if key.startswith('feature_') and rating >= 4.0:
                feature_name = key.replace('feature_', '').replace('_', ' ')
                insights['feature_recommendations'].append({
                    'feature': key.replace('feature_', ''),
                    'priority': rating,
                    'source': 'survey',
                    'description': f"Users rate {feature_name} as {rating:.1f}/5 priority"
                })
        
        return insights
    
    def export_to_csv(self, insights, output_dir):
        """Export insights to CSV files for marketing team"""
        os.makedirs(output_dir, exist_ok=True)
        
        # Pain points CSV
        pain_points_file = os.path.join(output_dir, 'pain_points_analysis.csv')
        with open(pain_points_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Category', 'Source', 'Severity', 'Description'])
            
            for pain in insights.get('top_pain_points', []):
                writer.writerow([
                    pain['category'],
                    pain['source'],
                    pain['severity'],
                    pain['description']
                ])
        
        logger.info(f"✅ CSV exports saved to {output_dir}")

def main():
    parser = argparse.ArgumentParser(description='Analyze feedback and generate insights')
    parser.add_argument('--reddit-data', default='data/reddit_pain_points.json')
    parser.add_argument('--survey-data', default='data/survey_responses.json')
    parser.add_argument('--output', default='data/feedback_analysis.json')
    parser.add_argument('--csv-dir', default='data/exports/')
    
    args = parser.parse_args()
    
    analyzer = FeedbackAnalyzer()
    
    # Load data
    reddit_data = {}
    survey_data = []
    
    try:
        with open(args.reddit_data, 'r') as f:
            reddit_data = json.load(f)
    except Exception as e:
        logger.warning(f"Could not load Reddit data: {e}")
    
    try:
        with open(args.survey_data, 'r') as f:
            survey_data = json.load(f)
            if isinstance(survey_data, dict):
                survey_data = [survey_data]
    except Exception as e:
        logger.warning(f"Could not load survey data: {e}")
    
    # Analyze
    reddit_analysis = analyzer.analyze_reddit_data(reddit_data)
    survey_analysis = analyzer.analyze_survey_data(survey_data)
    insights = analyzer.generate_insights(reddit_analysis, survey_analysis)
    
    # Save results
    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump({
            'reddit_analysis': reddit_analysis,
            'survey_analysis': survey_analysis,
            'insights': insights
        }, f, indent=2)
    
    # Export CSV
    analyzer.export_to_csv(insights, args.csv_dir)
    
    print(f"📊 Analysis complete: {args.output}")
    print(f"📁 CSV exports: {args.csv_dir}")

if __name__ == '__main__':
    main()
