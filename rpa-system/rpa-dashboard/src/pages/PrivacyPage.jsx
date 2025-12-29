import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import styles from './PrivacyPage.module.css';

export default function PrivacyPage() {
  const { theme, toggle } = useTheme();

  return (
    <div className={styles.page} data-theme={theme}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <button
            type="button"
            onClick={toggle}
            className={styles.themeToggle}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</p>

          <section className={styles.section}>
            <h2>1. Introduction</h2>
            <p>
              Welcome to EasyFlow ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our website and in using our products and services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our automation platform.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Information We Collect</h2>
            <h3>2.1 Information You Provide</h3>
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
              <li>Account information (name, email address, password)</li>
              <li>Payment information (processed securely through third-party payment processors)</li>
              <li>Integration credentials (OAuth tokens, API keys) - encrypted and stored securely</li>
              <li>Workflow and automation data</li>
              <li>Support communications</li>
            </ul>

            <h3>2.2 Automatically Collected Information</h3>
            <p>We automatically collect certain information when you use our services:</p>
            <ul>
              <li>Usage data (features used, frequency of use)</li>
              <li>Device information (browser type, operating system)</li>
              <li>Log data (IP address, access times, pages viewed)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Personalize and improve your experience</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information. This includes:
            </p>
            <ul>
              <li>Encryption of sensitive data (integration credentials, passwords)</li>
              <li>Secure data transmission using HTTPS/TLS</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication</li>
              <li>Secure storage infrastructure</li>
            </ul>
            <p>
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal information. We may share your information only in the following circumstances:</p>
            <ul>
              <li><strong>Service Providers:</strong> With third-party service providers who perform services on our behalf (e.g., payment processing, hosting, analytics)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Integration Credentials</h2>
            <p>
              When you connect third-party services (Slack, Gmail, Google Sheets, etc.) to EasyFlow, we store your OAuth tokens and API keys in encrypted form. These credentials are:
            </p>
            <ul>
              <li>Encrypted at rest using industry-standard encryption</li>
              <li>Only used to perform the actions you authorize</li>
              <li>Never shared with third parties except the service provider (e.g., Google, Slack)</li>
              <li>Deleted immediately when you disconnect an integration</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>7. Your Rights and Choices</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability (receive your data in a structured format)</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p>To exercise these rights, please contact us at the email address provided below.</p>
          </section>

          <section className={styles.section}>
            <h2>8. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or regulatory purposes.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Children's Privacy</h2>
            <p>
              Our service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. We take appropriate safeguards to ensure your information receives adequate protection.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className={styles.section}>
            <h2>13. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:support@useeasyflow.com">support@useeasyflow.com</a></li>
              <li><strong>Phone:</strong> <a href="tel:+12034494970">+1 (203) 449-4970</a></li>
              <li><strong>Website:</strong> <Link to="/">tryeasyflow.com</Link></li>
            </ul>
          </section>
        </div>

        <div className={styles.footer}>
          <Link to="/" className={styles.backLink}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

