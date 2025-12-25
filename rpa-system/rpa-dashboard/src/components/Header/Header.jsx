import React, { useState, lazy, Suspense } from 'react';
import { useI18n } from '../../i18n';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../utils/ThemeContext';
import styles from './Header.module.css';
import supabase, { initSupabase } from '../../utils/supabaseClient';
import PropTypes from 'prop-types';
import { usePlan } from '../../hooks/usePlan';

// PERFORMANCE: Lazy-load heavy components not needed for initial render
const NotificationCenter = lazy(() => import('../NotificationCenter/NotificationCenter'));
const ContactModal = lazy(() => import('./ContactModal'));
const DocumentationGuide = lazy(() => import('../DocumentationGuide/DocumentationGuide'));

const Header = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  // language features removed

  const isActive = (path) => {
    if (location.pathname === path) return true;
    // treat parent paths as active (e.g. /app should be active for /app/tasks)
    return location.pathname.startsWith(path.endsWith('/') ? path : path + '/');
  };

  async function handleSignOut() {
    try {
      const client = await initSupabase();
      await client.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      navigate('/auth');
    }
  }

  function handleSignIn() {
    navigate('/auth');
  }

  const { t } = useI18n();
  const { planData, trialDaysLeft } = usePlan();
  const { theme } = useTheme() || { theme: 'light' };

  return (
    <header className={styles.header} data-theme={theme}>
      <div className={styles.container}>
        {/* Brand / Logo */}
        <div className={styles.brand}>
          <h1 className={styles.logo}>
            <Link to="/" className={styles.logoLink}>
              EasyFlow
            </Link>
          </h1>
        </div>

        {/* Navigation */}
        {user && (
          <nav className={styles.nav}>
            <Link
              to="/app"
              className={`${styles.navLink} ${
                isActive('/app') &&
                !isActive('/app/tasks') &&
                !isActive('/app/history') &&
                !isActive('/app/files') &&
                !isActive('/app/workflows') &&
                !isActive('/app/bulk-processor')
                  ? styles.activeNavLink
                  : ''
              }`}
            >
              {t('nav.dashboard','Dashboard')}
            </Link>

            <Link
              to="/app/tasks"
              className={`${styles.navLink} ${
                isActive('/app/tasks') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.tasks','Task Management')}
            </Link>

            <Link
              to="/app/history"
              className={`${styles.navLink} ${
                isActive('/app/history') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.history','Automation History')}
            </Link>

            <Link
              to="/app/files"
              className={`${styles.navLink} ${
                isActive('/app/files') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.files','Files')}
            </Link>

            {/* Always show workflows link - paywall will handle access control */}
            <Link
              to="/app/workflows"
              className={`${styles.navLink} ${
                isActive('/app/workflows') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.workflows','Workflows')}
            </Link>

            {/* Business Rules - Reusable rules for workflows */}
            <Link
              to="/app/rules"
              className={`${styles.navLink} ${
                isActive('/app/rules') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.rules','Rules')}
            </Link>

            {/* Bulk Processing - Professional+ feature with paywall protection */}
            <Link
              to="/app/bulk-processor"
              className={`${styles.navLink} ${
                isActive('/app/bulk-processor') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.bulk_processing','Bulk Processing')}
            </Link>

            {/* Analytics - Professional+ feature */}
            <Link
              to="/app/analytics"
              className={`${styles.navLink} ${
                isActive('/app/analytics') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.analytics','Analytics')} 
              {(!planData?.plan || (planData.plan.price_cents === 0 || planData.plan.name?.toLowerCase() === 'hobbyist' || planData.plan.name?.toLowerCase() === 'free')) && <span className={styles.proIcon}>✨</span>}
            </Link>

            {/* Integrations - Professional+ feature */}
            <Link
              to="/app/integrations"
              className={`${styles.navLink} ${
                isActive('/app/integrations') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.integrations','Integrations')}
              {(!planData?.plan || ['Hobbyist', 'Starter'].includes(planData.plan.name)) && <span className={styles.proIcon}>✨</span>}
            </Link>

            {/* Webhooks - Professional+ feature */}
            <Link
              to="/app/webhooks"
              className={`${styles.navLink} ${
                isActive('/app/webhooks') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.webhooks','Webhooks')}
              {(!planData?.plan || ['Hobbyist', 'Starter'].includes(planData.plan.name)) && <span className={styles.proIcon}>✨</span>}
            </Link>

            {/* Teams - Professional+ feature */}
            <Link
              to="/app/teams"
              className={`${styles.navLink} ${
                isActive('/app/teams') ? styles.activeNavLink : ''
              }`}
            >
              {t('nav.teams','Teams')}
              {(!planData?.plan || ['Hobbyist', 'Starter'].includes(planData.plan.name)) && <span className={styles.proIcon}>✨</span>}
            </Link>
          </nav>
        )}

        {/* User Menu */}
        <div className={styles.userMenu}>
          {user ? (
            <>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {user?.name || user?.email || 'User'}
                </span>
                <span className={styles.userRole}>
                  {user?.role || 'Member'}
                </span>
              </div>

              {/* Trial countdown pill */}
              {planData?.plan?.is_trial && planData?.plan?.expires_at && (
                <div
                  title={`Trial ends ${new Date(planData.plan.expires_at).toLocaleDateString()}`}
                  style={{
                    marginRight: 12,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'var(--color-primary-50)',
                    color: 'var(--color-primary-700)',
                    border: '1px solid var(--color-primary-300)',
                    fontSize: 12,
                  }}
                >
                  {trialDaysLeft()}d left trial
                </div>
              )}

              <div className={styles.avatar}>
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>

              <div className={styles.userActions}>
                <Suspense fallback={<div className={styles.notificationPlaceholder} />}>
                  <NotificationCenter user={user} />
                </Suspense>
                <Link className={styles.actionButton} to="/app/settings">
                  {t('nav.settings','Settings')}
                </Link>
                <button
                  className={styles.actionButton}
                  onClick={() => setShowDocs(true)}
                  title="Learn & Support"
                >
                  {t('nav.documentation','Documentation')}
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() => setShowContact(true)}
                >
                  {t('nav.contact','Contact')}
                </button>
                <button
                  className={`${styles.actionButton} ${styles.signOutButton}`}
                  onClick={handleSignOut}
                >
                  {t('auth.sign_out','Sign out')}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.userActions}>
  <button className={styles.actionButton} onClick={handleSignIn}>{t('auth.sign_in','Sign In')}</button>
            </div>
          )}
        </div>
      </div>

      {/* Documentation Modal */}
      {showDocs && (
        <div className={styles.modalOverlay} onClick={() => setShowDocs(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={() => setShowDocs(false)}>&times;</button>
            <Suspense fallback={<div>Loading...</div>}>
              <DocumentationGuide />
            </Suspense>
          </div>
        </div>
      )}
      {/* Contact Modal */}
      {showContact && (
        <Suspense fallback={null}>
          <ContactModal
            open={showContact}
            onClose={() => setShowContact(false)}
          />
        </Suspense>
      )}
    </header>
  );
};

Header.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
  }),
  onLogout: PropTypes.func,
};

Header.defaultProps = {
  user: null,
  onLogout: () => {},
};

export default Header;
