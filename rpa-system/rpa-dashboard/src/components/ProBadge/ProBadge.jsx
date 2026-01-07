import React from 'react';
import { FiZap } from 'react-icons/fi';
import styles from './ProBadge.module.css';

/**
 * ProBadge - Small "PRO" badge on paid features
 * Purple badge positioned absolute top-right
 */
const ProBadge = ({ 
 variant = 'default', // 'default', 'small', 'large'
 position = 'top-right', // 'top-right', 'top-left', 'inline'
 showIcon = true,
 text = 'PRO',
 className = ''
}) => {
 const badgeClasses = [
 styles.badge,
 styles[variant],
 styles[position.replace('-', '_')],
 className
 ].filter(Boolean).join(' ');

 return (
 <div className={badgeClasses}>
 {showIcon && <FiZap className={styles.icon} />}
 <span className={styles.text}>{text}</span>
 </div>
 );
};

export default ProBadge;