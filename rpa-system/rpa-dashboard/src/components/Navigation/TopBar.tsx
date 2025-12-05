import React, { useState } from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { Menu, Bell, Search, Sun, Moon, Contrast } from '../Icons/Icons';
import styles from './TopBar.module.css';

interface TopBarProps {
  onMenuToggle: () => void;
  title: string;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, title }) => {
  const { settings, updateSettings, announceToScreenReader } =
    useAccessibility();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const toggleTheme = async () => {
    const newTheme = settings.highContrastMode ? 'light' : 'high-contrast';
    await updateSettings({ highContrastMode: !settings.highContrastMode });
    announceToScreenReader(`Switched to ${newTheme} theme`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      announceToScreenReader(`Searching for ${searchQuery}`);
      // Implement search functionality
    }
  };

  return (
    <header className={styles.topBar} role="banner">
      <div className={styles.leftSection}>
        <button
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          aria-expanded="false"
        >
          <Menu size={20} />
        </button>

        <h1 className={`${styles.title} heading-4`}>{title}</h1>
      </div>

      <div className={styles.centerSection}>
        <form
          onSubmit={handleSearch}
          className={styles.searchForm}
          role="search"
        >
          <div className={styles.searchContainer}>
            <Search
              size={16}
              className={styles.searchIcon}
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Search tasks"
            />
          </div>
        </form>
      </div>

      <div className={styles.rightSection}>
        <button
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={`Switch to ${
            settings.highContrastMode ? 'normal' : 'high contrast'
          } theme`}
          title="Toggle theme"
        >
          {settings.highContrastMode ? (
            <Sun size={20} />
          ) : (
            <Contrast size={20} />
          )}
        </button>

        <div className={styles.notificationContainer}>
          <button
            className={`${styles.iconButton} ${styles.notificationButton}`}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell size={20} />
            <span
              className={styles.notificationBadge}
              aria-label="3 unread notifications"
            >
              3
            </span>
          </button>

          {showNotifications && (
            <div
              className={styles.notificationDropdown}
              role="menu"
              aria-label="Notifications"
            >
              <div className={styles.notificationHeader}>
                <h3 className="heading-6">Notifications</h3>
                <button
                  className={styles.linkButton}
                  onClick={() => setShowNotifications(false)}
                >
                  Mark all read
                </button>
              </div>

              <div className={styles.notificationList}>
                <div className={styles.notificationItem} role="menuitem">
                  <div className={styles.notificationContent}>
                    <p className="body-small font-medium">Task Due Soon</p>
                    <p className="body-small text-muted">
                      Complete project proposal is due in 2 hours
                    </p>
                  </div>
                  <div className={styles.notificationTime}>
                    <span className="body-small text-subtle">2h</span>
                  </div>
                </div>

                <div className={styles.notificationItem} role="menuitem">
                  <div className={styles.notificationContent}>
                    <p className="body-small font-medium">
                      Achievement Unlocked!
                    </p>
                    <p className="body-small text-muted">
                      You earned the "Early Bird" achievement
                    </p>
                  </div>
                  <div className={styles.notificationTime}>
                    <span className="body-small text-subtle">1d</span>
                  </div>
                </div>
              </div>

              <div className={styles.notificationFooter}>
                <button className={styles.linkButton}>
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
