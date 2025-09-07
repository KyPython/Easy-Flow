import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import { supabase } from '../../utils/supabaseClient';
import PropTypes from 'prop-types';
import ContactModal from './ContactModal';
import NotificationCenter from '../NotificationCenter/NotificationCenter';

const Header = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);
  // language features removed

  const isActive = (path) => {
    if (location.pathname === path) return true;
    // treat parent paths as active (e.g. /app should be active for /app/tasks)
    return location.pathname.startsWith(path.endsWith('/') ? path : path + '/');
  };

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
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

  return (
    <header className={styles.header}>
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
        <nav className={styles.nav}>
          <Link
            to="/app"
            className={`${styles.navLink} ${
              isActive('/app') &&
              !isActive('/app/tasks') &&
              !isActive('/app/history')
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
        </nav>

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

              <div className={styles.avatar}>
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>

              <div className={styles.userActions}>
                <NotificationCenter user={user} />
                
                <Link className={styles.actionButton} to="/app/settings">
                  {t('nav.settings','Settings')}
                </Link>

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

      {/* Contact Modal */}
      <ContactModal
        open={showContact}
        onClose={() => setShowContact(false)}
      />
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
