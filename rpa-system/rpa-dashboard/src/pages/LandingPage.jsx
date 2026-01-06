// ...existing code...
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';
import { useTheme } from '../utils/ThemeContext';
import { useI18n } from '../i18n';
import { UserCountBadge, ActivityCounter, TrustBadges } from '../components/SocialProof';
import { getABTestVariant, trackABTestView } from '../utils/abTesting';
import { captureAndStoreUTM } from '../utils/utmCapture';

export default function LandingPage() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const [headlineVariant, setHeadlineVariant] = useState('A');

  // Capture UTM parameters and set A/B test variant on mount
  useEffect(() => {
    // Capture UTM parameters
    captureAndStoreUTM();
    
    // Get A/B test variant for landing page headline
    const variant = getABTestVariant('landing_headline');
    setHeadlineVariant(variant);
    
    // Track A/B test view
    trackABTestView('landing_headline', variant).catch(e => 
      console.debug('Failed to track A/B test view:', e)
    );
  }, []);

  // Headline variants
  const headlineVariants = {
    A: '🚀 Stop Doing Boring Work', // Current
    B: '⚡ Eliminate Manual Logins Forever' // New
  };

  const headline = headlineVariants[headlineVariant] || headlineVariants.A;

  return (
    // apply data-theme for scoped selectors and ensure footer and all children see the current theme
    <div className={styles.page} data-theme={theme}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>{headline}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Link to="/privacy" className={styles.footerLink} style={{ fontSize: 'var(--font-size-sm)', textDecoration: 'underline' }}>Privacy Policy</Link>
              <button
                type="button"
                onClick={toggle}
                className={styles.themeToggle}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
          </div>

          <p className={styles.lead}>
            <strong>Stop Copy/Pasting Between Tools</strong><br/><br/>
            <strong>Before:</strong> Copy data from Slack → paste into Google Sheets. Copy from email → paste into Notion. Copy from forms → paste into CRM. Hours wasted every week.<br/><br/>
            <strong>After:</strong> Connect your tools once. EasyFlow automatically moves data between them. No more manual copy/paste. No coding required.<br/><br/>
            <strong>Zero-infrastructure automation</strong> - No servers, no DevOps. Just connect and go.
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '16px', textAlign: 'center' }}>
            By using EasyFlow, you agree to our{' '}
            <Link to="/terms" style={{ textDecoration: 'underline' }}>Terms of Use</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
          <div className={styles.ctaGroup}>
            <a href="https://calendly.com/kyjahn-smith/consultation" target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>
              {t('landing.book_consultation', 'Book a 20-min Workflow Setup Call')}
            </a>
            <Link to="/pricing" className={styles.ctaSecondary}>{t('landing.view_pricing','View Pricing')}</Link>
          </div>
          
          {/* Social Proof */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <UserCountBadge variant="join" />
          </div>
          
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            <TrustBadges />
          </div>
        </div>
      </div>

      {/* Activity Counter Section */}
      <section className={styles.activitySection}>
        <ActivityCounter />
      </section>

      {/* ICP / Who This Is For Section */}
      <section className={styles.icpSection}>
        <h2 className={styles.sectionTitle}>{t('landing.who_this_is_for', 'Who This Is For')}</h2>
        <div className={styles.icpCard}>
          <p className={styles.icpDescription}>
            {t('landing.icp_description', 'Startup founders and small business owners who spend hours weekly on repetitive tasks like copying data between systems, sending the same emails, or manually updating spreadsheets.')}
          </p>
          <h3 className={styles.icpSubtitle}>{t('landing.icp_subtitle', 'This is for you if you:')}</h3>
          <ul className={styles.icpList}>
            <li>{t('landing.icp_bullet_1', 'Manually send the same type of email or message multiple times per week')}</li>
            <li>{t('landing.icp_bullet_2', 'Copy data between systems (CRM, spreadsheets, email) as part of your routine')}</li>
            <li>{t('landing.icp_bullet_3', 'Spend 30+ minutes weekly on a task you could describe in simple steps')}</li>
          </ul>
          <p className={styles.icpBenefit}>
            <strong>{t('landing.early_users_get', 'Early users get:')}</strong>{' '}
            {t('landing.early_users_benefits', 'Free done-with-you setup + priority support + direct line to the builder (me, KyJahn)')}
          </p>
        </div>
      </section>

      {/* ✅ NEW FEATURE: Cost Savings Highlight */}
      <section className={styles.featuresSection} style={{ background: 'var(--color-success-50)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', margin: 'var(--spacing-xl) 0' }}>
        <h2 className={styles.sectionTitle}>💰 Save Up to 25% on Automation Costs</h2>
        <p style={{ textAlign: 'center', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-lg)', color: 'var(--text-muted)' }}>
          Unlike Zapier and Make, EasyFlow automatically optimizes costs with smart execution modes
        </p>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚡</div>
            <h3 className={styles.featureTitle}>Instant Mode</h3>
            <p className={styles.featureText}>
              <strong>For urgent tasks:</strong> User-triggered workflows run immediately. Perfect for real-time automation needs.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚖️</div>
            <h3 className={styles.featureTitle}>Balanced Mode</h3>
            <p className={styles.featureText}>
              <strong>Standard performance:</strong> 12.5% cost savings. Best for most workflows that don't need instant execution.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>💰</div>
            <h3 className={styles.featureTitle}>Scheduled Mode</h3>
            <p className={styles.featureText}>
              <strong>Cost-optimized:</strong> 25% savings by batching workflows during off-peak hours. Perfect for background tasks.
            </p>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-md)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Smart scheduling automatically selects the best mode based on your workflow's urgency and context
        </p>
      </section>

      <section className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>{t('landing.why_choose','Stop Copy/Pasting Between Tools')}</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>💬</div>
            <h3 className={styles.featureTitle}>Slack → Google Sheets</h3>
            <p className={styles.featureText}>
              <strong>Before:</strong> Manually copy customer feedback from Slack messages into your tracking spreadsheet (30 min daily)<br/><br/>
              <strong>After:</strong> New Slack message → Automatically added to Google Sheets. One-click template setup.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📧</div>
            <h3 className={styles.featureTitle}>Email → Notion</h3>
            <p className={styles.featureText}>
              <strong>Before:</strong> Copy important emails into your Notion workspace manually (20 min daily)<br/><br/>
              <strong>After:</strong> Important emails automatically saved to Notion database. No copy/paste needed.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📝</div>
            <h3 className={styles.featureTitle}>Form → CRM</h3>
            <p className={styles.featureText}>
              <strong>Before:</strong> Check forms, copy contact info, paste into CRM, assign to team (45 min daily)<br/><br/>
              <strong>After:</strong> Form submitted → Contact automatically added to CRM → Team notified. Zero manual work.
            </p>
          </div>
        </div>
        
        <div style={{ marginTop: '32px', textAlign: 'center', padding: '24px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '12px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 600 }}>
            🎯 Pre-Built Templates - No Setup Required
          </h3>
          <p style={{ marginBottom: '16px', fontSize: '16px', lineHeight: '1.6' }}>
            Don't build from scratch. Choose a template, connect your accounts, and you're done.
            <br/>Popular templates: <strong>Slack→Sheets</strong>, <strong>Email→Notion</strong>, <strong>Form→CRM</strong>
          </p>
        </div>

        <div className={styles.ctaBig}>
          <a href="https://calendly.com/kyjahn-smith/consultation" target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>
            {t('landing.book_consultation', 'Book a 20-min Workflow Setup Call')}
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>&copy; 2025 {t('landing.footer_tagline','EasyFlow. Intelligent RPA Automation Platform.')}</p>
        <div className={styles.footerLinks}>
          <a href="tel:+12034494970" className={styles.footerLink}>{t('landing.call_support','Call Support: +1 (203) 449-4970')}</a>
          <a href="mailto:support@useeasyflow.com" className={styles.footerLink}>{t('landing.email_support','Email: support@useeasyflow.com')}</a>
        </div>
        <div className={styles.footerLinks} style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
          <Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link>
          <Link to="/terms" className={styles.footerLink}>Terms of Use</Link>
        </div>
      </footer>
    </div>
  );
}