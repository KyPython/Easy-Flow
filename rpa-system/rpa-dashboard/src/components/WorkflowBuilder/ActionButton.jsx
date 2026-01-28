import React from 'react';
import PropTypes from 'prop-types';
import styles from './ActionButton.module.css';
import LoadingSpinner from './LoadingSpinner';

const ActionButton = ({
 children,
 variant = 'primary',
 size = 'medium',
 disabled = false,
 loading = false,
 icon = null,
 onClick,
 type = 'button',
 className = '',
 ...props
}) => {
 const buttonClasses = [
 styles.actionButton,
 styles[variant],
 styles[size],
 disabled && styles.disabled,
 loading && styles.loading,
 className
 ].filter(Boolean).join(' ');

 const handleClick = (e) => {
 if (disabled || loading) return;
 onClick?.(e);
 };

 return (
 <button
 type={type}
 className={buttonClasses}
 onClick={handleClick}
 disabled={disabled || loading}
 {...props}
 >
 {loading ? (
 <LoadingSpinner size="small" color="inherit" />
 ) : (
 <>
 {icon && <span className={styles.buttonIcon}>{icon}</span>}
 <span className={styles.buttonText}>{children}</span>
 </>
 )}
 </button>
 );
};

export default ActionButton;

ActionButton.propTypes = {
 children: PropTypes.node,
 variant: PropTypes.string,
 size: PropTypes.string,
 disabled: PropTypes.bool,
 loading: PropTypes.bool,
 icon: PropTypes.node,
 onClick: PropTypes.func,
 type: PropTypes.string,
 className: PropTypes.string
};