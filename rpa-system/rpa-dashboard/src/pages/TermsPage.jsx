import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import styles from './TermsPage.module.css';

export default function TermsPage() {
  const { theme, toggle } = useTheme();

  return (
    <div className={styles.page} data-theme={theme}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Terms of Use</h1>
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
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using EasyFlow ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Description of Service</h2>
            <p>
              EasyFlow is an automation platform that allows users to connect various third-party services (such as Slack, Gmail, Google Sheets, and others) to automate repetitive tasks and workflows. The Service enables users to create, manage, and execute automated workflows across multiple platforms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. User Accounts</h2>
            <h3>3.1 Account Creation</h3>
            <p>To use certain features of the Service, you must register for an account. You agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and update your information to keep it accurate</li>
              <li>Maintain the security of your password and identification</li>
              <li>Accept all responsibility for activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>

            <h3>3.2 Account Responsibility</h3>
            <p>
              You are responsible for all activities that occur under your account, including any actions taken by third parties who access your account with or without your permission.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Transmit any malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorized access to any systems or networks</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Impersonate any person or entity</li>
              <li>Collect or store personal data about other users without permission</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Third-Party Integrations</h2>
            <p>
              The Service allows you to connect third-party services through OAuth and API integrations. When you connect a third-party service:
            </p>
            <ul>
              <li>You grant us permission to access and use your data from that service as necessary to provide the Service</li>
              <li>You are responsible for ensuring you have the right to grant such access</li>
              <li>You must comply with the terms of service of the third-party service</li>
              <li>We store your credentials securely and encrypted, and only use them to perform actions you authorize</li>
              <li>You can disconnect any integration at any time, which will immediately revoke our access</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by EasyFlow and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p>
              You retain ownership of any content you create or upload to the Service. By using the Service, you grant us a license to use, store, and process your content as necessary to provide the Service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Payment and Billing</h2>
            <h3>7.1 Subscription Plans</h3>
            <p>
              The Service is offered on a subscription basis. You agree to pay all fees associated with your selected plan. Fees are billed in advance on a monthly or annual basis, as selected.
            </p>

            <h3>7.2 Payment Processing</h3>
            <p>
              Payments are processed by third-party payment processors. You agree to provide accurate payment information and authorize us to charge your payment method for all fees.
            </p>

            <h3>7.3 Refunds</h3>
            <p>
              Refund policies are determined by your subscription plan. Generally, we do not provide refunds for partial subscription periods, but you may cancel your subscription at any time.
            </p>

            <h3>7.4 Price Changes</h3>
            <p>
              We reserve the right to change our pricing at any time. We will provide notice of price changes, and you may cancel your subscription if you do not agree to the new pricing.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Service Availability</h2>
            <p>
              We strive to provide reliable service but do not guarantee that the Service will be available at all times. The Service may be unavailable due to maintenance, updates, or circumstances beyond our control. We are not liable for any damages resulting from service unavailability.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, EASYFLOW SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless EasyFlow, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or relating to your use of the Service, violation of these Terms, or infringement of any rights of another.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
            <p>
              You may terminate your account at any time by contacting us or using the account deletion feature in your settings.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which EasyFlow operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>14. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Use, please contact us:
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

