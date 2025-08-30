import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import { supabase } from '../../utils/supabaseClient';
import ContactModal from './ContactModal';

const Header = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);

  const isActive = (path) => {
    if (location.pathname === path) return true;
    // treat parent paths as active (e.g. /app should be active for /app/tasks)
    return location.pathname.startsWith(path.endsWith('/') ? path : path + '/');
  };

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    navigate('/auth');
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <h1 className={styles.logo}>
            <Link to="/" className={styles.logoLink}>EasyFlow</Link>
          </h1>
        </div>
        
        <nav className={styles.nav}>
          <Link 
            to="/app" 
            className={`${styles.navLink} ${isActive('/app') && !isActive('/app/tasks') && !isActive('/app/history') ? styles.active : ''}`}
          >
            Dashboard
          </Link>
          <Link 
            to="/app/tasks" 
            className={`${styles.navLink} ${isActive('/app/tasks') ? styles.active : ''}`}   
          >
            Task Management
          </Link>
          <Link 
            to="/app/history"
            className={`${styles.navLink} ${isActive('/app/history') ? styles.active : ''}`} 
          >
            Automation History
          </Link>
        </nav>

        <div className={styles.userMenu}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name || 'User'}</span>
            <span className={styles.userRole}>{user?.role || 'Member'}</span>
          </div>
          
          <div className={styles.avatar}>
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          
          <div className={styles.userActions}>
            <Link 
              className={styles.actionButton} 
              to="/app/settings"
            >
              Settings
            </Link>
            
            <button 
              className={styles.actionButton} 
              onClick={() => setShowContact(true)}
            >
              Contact
            </button>
            
            <button 
              className={`${styles.actionButton} ${styles.signOutButton}`} 
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
      
      <ContactModal open={showContact} onClose={() => setShowContact(false)} />
    </header>
  );
};

export default Header;