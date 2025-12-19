#!/usr/bin/env python3
"""
Lead Magnet Checklist Generator
==============================

FUNCTIONALITY:
- Reads pain points from Reddit extraction JSON file
- Generates targeted PDF checklists addressing user frustrations
- Creates actionable bullet points and professional layouts
- Outputs downloadable PDFs named by pain point category

DEPENDENCIES: reportlab, json, jinja2 (optional for templates)
USAGE: python generate_checklists.py --input pain_points.json --output-dir pdfs/

ASSUMPTIONS:
- Pain points JSON follows the structure from fetch_reddit_feedback.py
- PDF generation uses reportlab for professional formatting
- Each checklist addresses 1-2 main pain points with 5-10 actionable items
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Any
import argparse

# PDF generation imports with fallbacks
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Flowable, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("⚠️ reportlab not installed. Install with: pip install reportlab")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChecklistGenerator:
    def __init__(self):
        """Initialize checklist generator with templates and styles"""
        self.checklist_templates = {
            'automation': {
                'title': 'Business Process Automation Checklist',
                'subtitle': 'Eliminate Manual Work & Reduce Errors',
                'intro': 'Stop wasting hours on repetitive tasks. This checklist helps you identify and automate key business processes to save time and reduce human error.',
                'items': [
                    'Identify your most time-consuming manual processes',
                    'Document current workflow steps and decision points', 
                    'Calculate time spent per task (hours per week/month)',
                    'Prioritize processes by impact vs. complexity',
                    'Choose the right automation tool for each process',
                    'Start with simple, high-impact automations first',
                    'Test automations thoroughly before full deployment',
                    'Create fallback procedures for automation failures',
                    'Monitor automation performance and ROI',
                    'Train team members on new automated workflows'
                ]
            },
            'self_hosting': {
                'title': 'Self-Hosting Security & Setup Checklist',
                'subtitle': 'Deploy Applications Safely & Efficiently',
                'intro': 'Self-hosting gives you control, but security is crucial. Follow this checklist to deploy applications safely while maintaining performance and reliability.',
                'items': [
                    'Choose a secure hosting provider or hardware setup',
                    'Configure firewall rules and network security',
                    'Set up SSL certificates for all public services',
                    'Implement strong authentication (2FA, key-based)',
                    'Configure automated backups and test restoration',
                    'Set up monitoring and alerting systems',
                    'Document your deployment and recovery procedures',
                    'Regular security updates and vulnerability scanning',
                    'Implement log management and analysis',
                    'Create disaster recovery and incident response plans'
                ]
            },
            'integration': {
                'title': 'API Integration Success Checklist',
                'subtitle': 'Connect Your Tools Without the Headaches',
                'intro': 'API integrations shouldn\'t take weeks to implement. Use this checklist to streamline your integration projects and avoid common pitfalls.',
                'items': [
                    'Read API documentation thoroughly before starting',
                    'Test API endpoints in a sandbox environment first',
                    'Implement proper authentication and security',
                    'Handle rate limiting and error responses gracefully',
                    'Set up comprehensive logging and monitoring',
                    'Create data validation and transformation logic',
                    'Implement retry mechanisms for failed requests',
                    'Document your integration for future maintenance',
                    'Plan for API versioning and deprecation',
                    'Test thoroughly with real-world data volumes'
                ]
            },
            'security': {
                'title': 'Business Data Security Checklist',
                'subtitle': 'Protect Your Business from Data Breaches',
                'intro': 'Data breaches can destroy businesses. This checklist helps you implement essential security measures to protect your company and customer data.',
                'items': [
                    'Conduct a comprehensive security audit',
                    'Implement multi-factor authentication everywhere',
                    'Encrypt sensitive data at rest and in transit',
                    'Establish access controls and user permissions',
                    'Create and test backup and recovery procedures',
                    'Train employees on security best practices',
                    'Set up network monitoring and intrusion detection',
                    'Develop incident response and communication plans',
                    'Ensure compliance with relevant regulations (GDPR, etc.)',
                    'Regular security assessments and penetration testing'
                ]
            },
            'general': {
                'title': 'Business Process Optimization Checklist',
                'subtitle': 'Streamline Operations & Boost Efficiency', 
                'intro': 'Inefficient processes waste time and money. Use this checklist to identify bottlenecks and optimize your business operations.',
                'items': [
                    'Map out your current business processes',
                    'Identify bottlenecks and pain points',
                    'Measure current performance metrics',
                    'Gather feedback from team members and customers',
                    'Research available tools and solutions',
                    'Prioritize improvements by impact and effort',
                    'Implement changes gradually and test thoroughly',
                    'Document new processes and train your team',
                    'Monitor results and measure improvements',
                    'Continuously iterate and optimize further'
                ]
            }
        }
    
    def load_pain_points(self, input_file: str) -> Dict[str, Any]:
        """Load pain points from JSON file"""
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"✅ Loaded pain points from {input_file}")
            return data
        except Exception as e:
            logger.error(f"❌ Failed to load pain points: {e}")
            return {}
    
    def customize_checklist(self, category: str, pain_points: List[Dict]) -> Dict[str, Any]:
        """Customize checklist based on extracted pain points"""
        base_template = self.checklist_templates.get(category, self.checklist_templates['general'])
        
        # Analyze pain points to customize content
        common_keywords = {}
        high_confidence_points = []
        
        for point in pain_points[:10]:  # Top 10 pain points
            for keyword in point.get('keywords', []):
                common_keywords[keyword] = common_keywords.get(keyword, 0) + 1
            
            if point.get('confidence', 0) > 0.7:
                high_confidence_points.append(point['text'])
        
        # Customize based on top keywords
        customized_items = base_template['items'].copy()
        
        # Add specific items based on common pain points
        if 'docker' in common_keywords and category == 'self_hosting':
            customized_items.insert(2, 'Set up Docker containers with proper resource limits')
        
        if 'security' in common_keywords:
            customized_items.insert(1, 'Address specific security vulnerabilities mentioned by users')
        
        if 'api' in common_keywords and category == 'integration':
            customized_items.insert(3, 'Implement proper API key management and rotation')
        
        return {
            'title': base_template['title'],
            'subtitle': base_template['subtitle'],
            'intro': base_template['intro'],
            'items': customized_items,
            'pain_point_count': len(pain_points),
            'top_keywords': sorted(common_keywords.items(), key=lambda x: x[1], reverse=True)[:5],
            'generated_date': datetime.now().strftime('%B %d, %Y')
        }
    
    def generate_pdf_checklist(self, checklist_data: Dict[str, Any], output_path: str):
        """Generate a professional PDF checklist"""
        if not REPORTLAB_AVAILABLE:
            logger.error("reportlab not available, generating text version instead")
            self.generate_text_checklist(checklist_data, output_path.replace('.pdf', '.txt'))
            return
        
        try:
            # Create PDF document
            doc = SimpleDocTemplate(output_path, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []
            
            # Custom styles
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=24,
                spaceAfter=12,
                textColor=colors.HexColor('#2E86C1')
            )
            
            subtitle_style = ParagraphStyle(
                'CustomSubtitle', 
                parent=styles['Normal'],
                fontSize=16,
                spaceAfter=20,
                textColor=colors.HexColor('#5D6D7E'),
                alignment=1  # Center
            )
            
            intro_style = ParagraphStyle(
                'CustomIntro',
                parent=styles['Normal'],
                fontSize=12,
                spaceAfter=20,
                leading=16
            )
            
            item_style = ParagraphStyle(
                'ChecklistItem',
                parent=styles['Normal'],
                fontSize=11,
                leftIndent=20,
                spaceAfter=8,
                leading=14
            )
            
            # Add title and subtitle
            story.append(Paragraph(checklist_data['title'], title_style))
            story.append(Paragraph(checklist_data['subtitle'], subtitle_style))
            story.append(Spacer(1, 20))
            
            # Add intro
            story.append(Paragraph('<b>About This Checklist:</b>', styles['Heading2']))
            story.append(Paragraph(checklist_data['intro'], intro_style))
            story.append(Spacer(1, 15))
            
            # Add checklist items
            story.append(Paragraph('<b>Your Action Checklist:</b>', styles['Heading2']))
            story.append(Spacer(1, 10))
            
            for i, item in enumerate(checklist_data['items'], 1):
                checkbox = '☐'
                story.append(Paragraph(f'{checkbox} <b>{i}.</b> {item}', item_style))
            
            story.append(Spacer(1, 30))
            
            # Add footer with metadata
            footer_text = f"""
            <b>Generated by EasyFlow</b><br/>
            Date: {checklist_data['generated_date']}<br/>
            Based on {checklist_data['pain_point_count']} user pain points<br/>
            Get more automation tools at: tryeasyflow.com
            """
            story.append(Paragraph(footer_text, styles['Normal']))
            
            # Build PDF
            doc.build(story)
            logger.info(f"✅ PDF checklist generated: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to generate PDF: {e}")
            # Fallback to text version
            self.generate_text_checklist(checklist_data, output_path.replace('.pdf', '.txt'))
    
    def generate_text_checklist(self, checklist_data: Dict[str, Any], output_path: str):
        """Generate text version of checklist as fallback"""
        try:
            content = f"""
{checklist_data['title']}
{checklist_data['subtitle']}
{'='*60}

ABOUT THIS CHECKLIST:
{checklist_data['intro']}

YOUR ACTION CHECKLIST:
"""
            for i, item in enumerate(checklist_data['items'], 1):
                content += f"\n[ ] {i}. {item}"
            
            content += f"""

---
Generated by EasyFlow on {checklist_data['generated_date']}
Based on {checklist_data['pain_point_count']} user pain points
Get more automation tools at: tryeasyflow.com
"""
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.info(f"✅ Text checklist generated: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to generate text checklist: {e}")
    
    def generate_all_checklists(self, pain_points_data: Dict[str, Any], output_dir: str):
        """Generate checklists for all categories with pain points"""
        os.makedirs(output_dir, exist_ok=True)
        
        generated_files = []
        pain_points = pain_points_data.get('pain_points', {})
        
        for category, points in pain_points.items():
            if not points:  # Skip empty categories
                continue
            
            logger.info(f"🔄 Generating checklist for category: {category}")
            
            # Customize checklist for this category
            checklist_data = self.customize_checklist(category, points)
            
            # Generate filename
            safe_category = category.replace('_', '-').replace(' ', '-').lower()
            filename = f"{safe_category}-checklist.pdf"
            output_path = os.path.join(output_dir, filename)
            
            # Generate PDF
            self.generate_pdf_checklist(checklist_data, output_path)
            
            generated_files.append({
                'category': category,
                'filename': filename,
                'path': output_path,
                'pain_point_count': len(points),
                'title': checklist_data['title']
            })
        
        # Generate summary file
        self.generate_summary_file(generated_files, pain_points_data, output_dir)
        
        return generated_files
    
    def generate_summary_file(self, generated_files: List[Dict], pain_points_data: Dict, output_dir: str):
        """Generate a summary JSON file for the frontend"""
        summary = {
            'generated_date': datetime.now().isoformat(),
            'total_checklists': len(generated_files),
            'checklists': generated_files,
            'stats': pain_points_data.get('stats', {}),
            'download_base_url': '/api/checklists/download/',
            'categories': list(set([f['category'] for f in generated_files]))
        }
        
        summary_path = os.path.join(output_dir, 'checklists_summary.json')
        
        try:
            with open(summary_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2)
            logger.info(f"✅ Summary file generated: {summary_path}")
        except Exception as e:
            logger.error(f"❌ Failed to generate summary: {e}")

def main():
    parser = argparse.ArgumentParser(description='Generate lead magnet checklists from pain points')
    parser.add_argument('--input', default='data/reddit_pain_points.json',
                       help='Input pain points JSON file')
    parser.add_argument('--output-dir', default='public/downloads/checklists',
                       help='Output directory for PDF checklists') 
    parser.add_argument('--format', choices=['pdf', 'text', 'both'], default='pdf',
                       help='Output format')
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = ChecklistGenerator()
    
    # Load pain points data
    pain_points_data = generator.load_pain_points(args.input)
    
    if not pain_points_data:
        logger.error("No pain points data loaded, exiting")
        return
    
    # Generate checklists
    generated_files = generator.generate_all_checklists(pain_points_data, args.output_dir)
    
    # Print summary
    print(f"\n📋 CHECKLIST GENERATION SUMMARY:")
    print(f"   Output directory: {args.output_dir}")
    print(f"   Generated checklists: {len(generated_files)}")
    
    for file_info in generated_files:
        print(f"   ✓ {file_info['category']}: {file_info['filename']} ({file_info['pain_point_count']} pain points)")
    
    print(f"\n🎯 Ready for download at: /api/checklists/download/")

if __name__ == '__main__':
    main()