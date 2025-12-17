// ...existing code...
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';
import { useTheme } from '../utils/ThemeContext';
import { useI18n } from '../i18n';
import { UserCountBadge, ActivityCounter, TrustBadges } from '../components/SocialProof';

export default function LandingPage() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  return (
    // apply data-theme for scoped selectors and ensure footer and all children see the current theme
    <div className={styles.page} data-theme={theme}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>🚀 Stop Doing Boring Work</h1>
            <button
              type="button"
              onClick={toggle}
              className={styles.themeToggle}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>

          <p className={styles.lead}>
            <strong>Before:</strong> Spend 3 hours every morning copying customer info from emails, updating spreadsheets, and sending follow-up messages.<br/><br/>
            <strong>After:</strong> Click one button. Get your morning work done in 30 seconds.<br/><br/>
            Turn any repetitive computer task into a simple one-click action. No coding required.
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

      <section className={styles.featuresSection}>
  <h2 className={styles.sectionTitle}>{t('landing.why_choose','What Boring Tasks Can You Automate?')}</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🤖</div>
            <h3 className={styles.featureTitle}>{t('landing.feature_intelligent_title','Send Welcome Emails Automatically')}</h3>
            <p className={styles.featureText}>
              <strong>Before:</strong> Copy each new customer's info, write personalized email, send manually (15 minutes per customer)<br/><br/>
              <strong>After:</strong> New customer signs up → Welcome email with their name and account details sent instantly
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧾</div>
            <h3 className={styles.featureTitle}>{t('landing.feature_bulk_title','Create Weekly Sales Reports Without Copying Data')}</h3>
            <p className={styles.featureText}>
              <strong>Before:</strong> Download data from 4 different systems, copy into Excel, calculate totals, format charts (2 hours every Monday)<br/><br/>
              <strong>After:</strong> Click one button → Professional report with charts emailed to you automatically
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🔗</div>
            <h3 className={styles.featureTitle}>{t('landing.feature_integrations_title','Update Your CRM When Someone Fills Out a Form')}</h3>
            <p className={styles.featureText}>
              <strong>Before:</strong> Check website forms hourly, copy contact info to CRM, assign to sales rep, send follow-up (45 minutes daily)<br/><br/>
              <strong>After:</strong> Form submitted → Contact added to CRM → Sales rep notified → Follow-up email sent
            </p>
          </div>
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
          <a href="mailto:kyjahntsmith@gmail.com" className={styles.footerLink}>{t('landing.email_support','Email: kyjahntsmith@gmail.com')}</a>
        </div>
      </footer>
    </div>
  );
}