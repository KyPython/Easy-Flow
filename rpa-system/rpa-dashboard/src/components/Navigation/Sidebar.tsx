import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import {
 LayoutGrid,
 ClipboardList,
 ChartBar,
 Zap,
 User,
 Settings,
 Bell,
 LogOut,
 X,
} from '../Icons/Icons';
import styles from './Sidebar.module.css';

interface SidebarProps {
 currentView: string;
 onViewChange: (view: string) => void;
 isOpen: boolean;
 onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
 currentView,
 onViewChange,
 isOpen,
 onClose,
}) => {
 const { user, logout } = useAuth();
 const { announceToScreenReader } = useAccessibility();

 const navigationItems = [
 {
 id: 'dashboard',
 label: 'Dashboard',
 icon: LayoutGrid,
 description: 'View your unified dashboard with automations and tasks',
 },
 {
 id: 'automations',
 label: 'Automations',
 icon: Zap,
 description: 'Manage your automation workflows',
 },
 {
 id: 'workflows',
 label: 'Workflows',
 icon: Zap,
 description: 'Build and manage workflow automations',
 },
 {
 id: 'tasks',
 label: 'Tasks',
 icon: ClipboardList,
 description: 'Manage your tasks and to-do items',
 },
 {
 id: 'analytics',
 label: 'Analytics',
 icon: ChartBar,
 description: 'View productivity insights and reports',
 },
 {
 id: 'notifications',
 label: 'Notifications',
 icon: Bell,
 description: 'View your notifications and alerts',
 },
 {
 id: 'profile',
 label: 'Profile',
 icon: User,
 description: 'Manage your user profile and account',
 },
 {
 id: 'settings',
 label: 'Accessibility Settings',
 icon: Settings,
 description: 'Configure accessibility preferences',
 },
 ];

 const handleNavigation = (viewId: string, label: string) => {
 onViewChange(viewId);
 announceToScreenReader(`Navigated to ${label}`);
 onClose();
 };

 const handleLogout = async () => {
 try {
 await logout();
 announceToScreenReader('Logged out successfully');
 } catch (error) {
 announceToScreenReader('Failed to log out');
 }
 };

 return (
 <>
 {/* Backdrop */}
 {isOpen && (
 <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
 )}

 {/* Sidebar */}
 <nav
 className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
 role="navigation"
 aria-label="Main navigation"
 >
 {/* Header */}
 <div className={styles.header}>
 <div className={styles.logo}>
 <h2 className="heading-5">EasyFlow Workspace</h2>
 </div>
 <button
 className={styles.closeButton}
 onClick={onClose}
 aria-label="Close navigation menu"
 >
 <X size={20} />
 </button>
 </div>

 {/* User Info */}
 <div className={styles.userInfo}>
 <div className={styles.avatar}>
 <img
 src={user?.profilePictureUrl || 'https://i.pravatar.cc/40?img=1'}
 alt={`${user?.displayName || user?.email}'s profile`}
 width={40}
 height={40}
 />
 </div>
 <div className={styles.userDetails}>
 <p className="body-small font-medium">
 {user?.displayName || user?.email}
 </p>
 <p className="body-small text-muted">User</p>
 </div>
 </div>

 {/* Navigation Items */}
 <ul className={styles.navList} role="list">
 {navigationItems.map(item => {
 const Icon = item.icon;
 const isActive = currentView === item.id;

 return (
 <li key={item.id}>
 <button
 className={`${styles.navItem} ${
 isActive ? styles.active : ''
 }`}
 onClick={() => handleNavigation(item.id, item.label)}
 aria-current={isActive ? 'page' : undefined}
 aria-describedby={`nav-desc-${item.id}`}
 >
 <Icon size={20} aria-hidden="true" />
 <span className={styles.navLabel}>{item.label}</span>
 </button>
 <div id={`nav-desc-${item.id}`} className="sr-only">
 {item.description}
 </div>
 </li>
 );
 })}
 </ul>

 {/* Footer */}
 <div className={styles.footer}>
 <button
 className={styles.logoutButton}
 onClick={handleLogout}
 aria-label="Sign out of your account"
 >
 <LogOut size={20} aria-hidden="true" />
 <span>Sign Out</span>
 </button>
 </div>
 </nav>
 </>
 );
};

export default Sidebar;
