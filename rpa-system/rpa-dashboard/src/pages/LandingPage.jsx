// ...existing code...
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';
import { useTheme } from '../utils/ThemeContext';

export default function LandingPage() {
  const { theme, toggle } = useTheme();

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

          <p className={styles.lead}>
            Transform your business with intelligent RPA automation. Streamline workflows, reduce manual tasks, and boost productivity with our powerful automation platform.
          </p>
          <div className={styles.ctaGroup}>
            <Link to="/auth" className={styles.ctaPrimary}>Get Started Today</Link>
            <Link to="/pricing" className={styles.ctaSecondary}>View Pricing</Link>
          </div>
        </div>
      </div>

      <section className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>Why Choose EasyFlow?</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🤖</div>
            <h3 className={styles.featureTitle}>Intelligent Automation</h3>
            <p className={styles.featureText}>Advanced RPA technology that learns and adapts to your business processes, making automation smarter and more efficient.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚡</div>
            <h3 className={styles.featureTitle}>Lightning Fast</h3>
            <p className={styles.featureText}>Execute complex tasks in seconds, not hours. Our optimized automation engine delivers results at incredible speed.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🔒</div>
            <h3 className={styles.featureTitle}>Enterprise Security</h3>
            <p className={styles.featureText}>Bank-level security with encrypted data transmission, secure authentication, and compliance with industry standards.</p>
          </div>
        </div>

        <div className={styles.ctaBig}>
          <Link to="/pricing" className={styles.ctaPrimary}>Start Your Free Trial</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p></p>
        <p>&copy; 2025 EasyFlow. Intelligent RPA Automation Platform.</p>
        <div className={styles.footerLinks}>
          <a href="tel:+12034494970" className={styles.footerLink}>Call Support: +1 (203) 449-4970</a>
          <a href="mailto:kyjahntsmith@gmail.com" className={styles.footerLink}>Email: kyjahntsmith@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}