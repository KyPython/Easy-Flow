import React from 'react';
import styles from './LandingPage.module.css';

export default function LandingPageClean() {
  return (
    <div className={styles.page}>
      <div style={{ position: 'relative' }}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>🚀 EasyFlow</h1>
            <p className={styles.lead}>
              Transform your business with intelligent RPA automation. Streamline workflows, reduce manual tasks, and boost productivity with our powerful automation platform.
            </p>
            <div className={styles.ctaGroup}>
              <a href="/auth" className={styles.ctaPrimary}>Get Started Today</a>
              <a href="/auth" className={styles.ctaSecondary}>Already have an account? Login</a>
            </div>
          </div>
        </div>

        <div className={styles.navTopRight}>
          <a href="/auth" className={styles.navButtonSecondary}>Login</a>
          <a href="/auth" className={styles.navButtonPrimary}>Sign Up</a>
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
          <a href="/pricing" className={styles.ctaPrimary}>Start Your Free Trial</a>
        </div>
      </section>

      <footer className={styles.footer}>
        <p style={{ margin: 0 }}>&copy; 2025 EasyFlow. Intelligent RPA Automation Platform.</p>
      </footer>
    </div>
  );
}
