// ...existing code...
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';
import { useTheme } from '../utils/ThemeContext';
import { useI18n } from '../i18n';

export default function LandingPage() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  return (
    // apply data-theme for scoped selectors and ensure footer and all children see the current theme
    <div className={styles.page} data-theme={theme}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>🚀 EasyFlow</h1>
            <button
              type="button"
              onClick={toggle}
              className={styles.themeToggle}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>

          <p className={styles.lead}>{t('landing.lead','Enterprise-grade automation platform with AI-powered data extraction, bulk processing, and seamless integrations. Automate hundreds of invoices, extract structured data from documents, and sync with your business tools - all with zero coding required.')}</p>
          <div className={styles.ctaGroup}>
            <Link to="/auth" className={styles.ctaPrimary}>{t('landing.get_started_today','Get Started Today')}</Link>
            <Link to="/pricing" className={styles.ctaSecondary}>{t('landing.view_pricing','View Pricing')}</Link>
          </div>
        </div>
      </div>

      <section className={styles.featuresSection}>
  <h2 className={styles.sectionTitle}>{t('landing.why_choose','Why Choose EasyFlow?')}</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🤖</div>
            <h3 className={styles.featureTitle}>{t('landing.feature_intelligent_title','AI-Powered Data Extraction')}</h3>
            <p className={styles.featureText}>{t('landing.feature_intelligent_text','Extract structured data from invoices, PDFs, and documents with 95%+ accuracy. Our AI understands context and delivers clean, organized data ready for your business systems.')}</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧾</div>
            <h3 className={styles.featureTitle}>{t('landing.feature_bulk_title','Bulk Processing at Scale')}</h3>
            <p className={styles.featureText}>{t('landing.feature_bulk_text','Process hundreds of invoices across multiple vendors simultaneously. Configure once, automate forever - handle entire accounting periods in minutes, not weeks.')}</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🔗</div>
            <h3 className={styles.featureTitle}>{t('landing.feature_integrations_title','Seamless Integrations')}</h3>
            <p className={styles.featureText}>{t('landing.feature_integrations_text','Direct integration with QuickBooks, Dropbox, Google Drive, Salesforce, and more. Sync processed data instantly to your business tools with enterprise-grade security.')}</p>
          </div>
        </div>

        <div className={styles.ctaBig}>
          <Link to="/pricing" className={styles.ctaPrimary}>{t('landing.start_free_trial','Start Your Free Trial')}</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p></p>
  <p>&copy; 2025 {t('landing.footer_tagline','EasyFlow. Intelligent RPA Automation Platform.')}</p>
        <div className={styles.footerLinks}>
          <a href="tel:+12034494970" className={styles.footerLink}>{t('landing.call_support','Call Support: +1 (203) 449-4970')}</a>
          <a href="mailto:kyjahntsmith@gmail.com" className={styles.footerLink}>{t('landing.email_support','Email: kyjahntsmith@gmail.com')}</a>
        </div>
      </footer>
    </div>
  );
}