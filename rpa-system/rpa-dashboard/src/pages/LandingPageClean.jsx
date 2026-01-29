import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';

export default function LandingPageClean() {
 return (
 <div className={styles.page}>
 <div style={{ position: 'relative' }}>
 <div className={styles.hero}>
 <div className={styles.heroContent}>
 <h1 className={styles.title}>🚀 Stop Doing Boring Work</h1>
 <p className={styles.lead}>
 <strong>Before:</strong> Spend 3 hours every morning copying customer info from emails, updating spreadsheets, and sending follow-up messages.<br/><br/>
 <strong>After:</strong> Click one button. Get your morning work done in 30 seconds.<br/><br/>
 Turn any repetitive computer task into a simple one-click action. No coding required.
 </p>
 <div className={styles.ctaGroup}>
 <Link to="/auth" className={styles.ctaPrimary}>Save 2+ Hours Every Day</Link>
 <Link to="/auth" className={styles.ctaSecondary}>Already have an account? Login</Link>
 </div>
 </div>
 </div>

 <div className={styles.navTopRight}>
 <Link to="/auth" className={styles.navButtonSecondary}>Login</Link>
 <Link to="/auth" className={styles.navButtonPrimary}>Sign Up</Link>
 </div>
 </div>

 <section className={styles.featuresSection}>
 <h2 className={styles.sectionTitle}>What Boring Tasks Can You Automate?</h2>
 <div className={styles.featuresGrid}>
 <div className={styles.featureCard}>
 <div className={styles.featureIcon}>🤖</div>
 <h3 className={styles.featureTitle}>Send Welcome Emails Automatically</h3>
 <p className={styles.featureText}>
 <strong>Before:</strong> Copy each new customer's info, write personalized email, send manually (15 minutes per customer)<br/><br/>
 <strong>After:</strong> New customer signs up → Welcome email with their name and account details sent instantly
 </p>
 </div>
 <div className={styles.featureCard}>
 <div className={styles.featureIcon}>⚡</div>
 <h3 className={styles.featureTitle}>Create Weekly Sales Reports Without Copying Data</h3>
 <p className={styles.featureText}>
 <strong>Before:</strong> Download data from 4 different systems, copy into Excel, calculate totals, format charts (2 hours every Monday)<br/><br/>
 <strong>After:</strong> Click one button → Professional report with charts emailed to you automatically
 </p>
 </div>
 <div className={styles.featureCard}>
 <div className={styles.featureIcon}>🔒</div>
 <h3 className={styles.featureTitle}>Update Your CRM When Someone Fills Out a Form</h3>
 <p className={styles.featureText}>
 <strong>Before:</strong> Check website forms hourly, copy contact info to CRM, assign to sales rep, send follow-up (45 minutes daily)<br/><br/>
 <strong>After:</strong> Form submitted → Contact added to CRM → Sales rep notified → Follow-up email sent
 </p>
 </div>
 </div>

 <div className={styles.ctaBig}>
 <Link to="/pricing" className={styles.ctaPrimary}>Start Saving Time Today</Link>
 </div>
 </section>

 <footer className={styles.footer}>
 <p style={{ margin: 0 }}>&copy; 2025 EasyFlow. Turn boring work into one-click actions.</p>
 </footer>
 </div>
 );
}
