import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPageRuleOfThirds.module.css';
import { useTheme } from '../utils/ThemeContext';
import { useI18n } from '../i18n';
import { UserCountBadge, ActivityCounter, TrustBadges } from '../components/SocialProof';
import { getABTestVariant, trackABTestView } from '../utils/abTesting';
import { captureAndStoreUTM } from '../utils/utmCapture';

/**
 * ✅ RULE OF THIRDS + C.R.A.P. REDESIGN
 * 
 * Problems with old design:
 * 1. CTA is dead center → no focal point (fights with headline/subtext)
 * 2. TWO CTAs side-by-side → splits attention
 * 3. Social proof BELOW CTA → user misses it
 * 4. Privacy links in HEADER → competes with CTA
 * 
 * New design principles:
 * - Rule of thirds: Primary CTA at intersection (33% down, 33% right)
 * - Contrast: Bright CTA button vs dark gradient (highest contrast on page)
 * - Repetition: Echo CTA color in social proof badges → visual path
 * - Alignment: Tight grouping (headline → benefit → CTA → proof)
 * - Proximity: Secondary CTA far below, separated by whitespace
 */

export default function LandingPageRuleOfThirds() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const [headlineVariant, setHeadlineVariant] = useState('A');

  useEffect(() => {
    captureAndStoreUTM();
    const variant = getABTestVariant('landing_headline');
    setHeadlineVariant(variant);
    trackABTestView('landing_headline', variant).catch(e => 
      console.debug('Failed to track A/B test view:', e)
    );
  }, []);

  const headlineVariants = {
    A: 'Stop Doing Boring Work',
    B: 'Eliminate Manual Logins Forever'
  };

  const headline = headlineVariants[headlineVariant] || headlineVariants.A;

  return (
    <div className={styles.page} data-theme={theme}>
      {/* HERO SECTION - Rule of Thirds Layout */}
      <div className={styles.hero}>
        {/* Theme toggle - top-right corner, low contrast (not competing) */}
        <button
          type="button"
          onClick={toggle}
          className={styles.themeToggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* ✅ RULE OF THIRDS GRID: 3x3 layout */}
        <div className={styles.heroGrid}>
          
          {/* LEFT COLUMN (1/3) - Headline + Benefit */}
          <div className={styles.heroLeft}>
            <h1 className={styles.headline}>
              🚀 {headline}
            </h1>
            
            {/* ✅ PROXIMITY: Benefit line tightly grouped with headline */}
            <p className={styles.benefit}>
              Stop copy/pasting between tools.<br/>
              <strong>Connect once. Automate forever.</strong>
            </p>

            {/* ✅ SOCIAL PROOF: ABOVE CTA (user sees it before clicking) */}
            <div className={styles.socialProofCompact}>
              <UserCountBadge variant="join" />
              <span className={styles.proofText}>• Trusted by 500+ teams</span>
            </div>
          </div>

          {/* RIGHT COLUMN (2/3) - CTA at intersection point */}
          <div className={styles.heroRight}>
            
            {/* ✅ CONTRAST: Brightest element on page (white on dark gradient) */}
            {/* ✅ RULE OF THIRDS: Positioned at 33% horizontal, 33% vertical */}
            <div className={styles.ctaHero}>
              <Link to="/savings-calculator" className={styles.ctaPrimary}>
                Try the Savings Calculator
                <span className={styles.ctaSubtext}>No credit card • 2 min setup</span>
              </Link>

              {/* ✅ REPETITION: Echo CTA accent color in trust badges below */}
              <div className={styles.trustBadgesInline}>
                <TrustBadges />
              </div>
            </div>

            {/* Before/After visualization (supporting content, lower contrast) */}
            <div className={styles.beforeAfter}>
              <div className={styles.beforeAfterItem}>
                <span className={styles.beforeAfterLabel}>Before</span>
                <p className={styles.beforeAfterText}>
                  Copy from Slack → Paste into Sheets<br/>
                  Copy from Email → Paste into Notion<br/>
                  <strong>Hours wasted weekly</strong>
                </p>
              </div>
              
              <div className={styles.arrow}>→</div>
              
              <div className={styles.beforeAfterItem}>
                <span className={styles.beforeAfterLabel}>After</span>
                <p className={styles.beforeAfterText}>
                  Connect tools once<br/>
                  EasyFlow auto-syncs data<br/>
                  <strong>Zero manual work</strong>
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ✅ SEPARATION: Secondary CTA far below, separated by space */}
        <div className={styles.secondaryCTAWrapper}>
          <a 
            href="https://calendly.com/kyjahn-smith/consultation" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.ctaSecondary}
          >
            Need help getting started? Book a free setup call →
          </a>
        </div>

        {/* Legal links - bottom, minimal contrast */}
        <div className={styles.legalLinks}>
          By using ModeLogic, you agree to our{' '}
          <Link to="/terms">Terms</Link> and{' '}
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </div>

      {/* Activity Counter Section */}
      <section className={styles.activitySection}>
        <ActivityCounter />
      </section>

      {/* Rest of landing page content... */}
      {/* (Keep existing ICP, features, pricing sections) */}
    </div>
  );
}
