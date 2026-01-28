import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 label?: string;
 error?: string;
 helperText?: string;
 variant?: 'default' | 'filled';
}

const Input: React.FC<InputProps> = ({
 label,
 error,
 helperText,
 variant = 'default',
 className,
 id,
 ...props
}) => {
 const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

 return (
 <div className={`${styles.inputGroup} ${className || ''}`}>
 {label && (
 <label htmlFor={inputId} className={styles.label}>
 {label}
 {props.required && <span className={styles.required}>*</span>}
 </label>
 )}
 
 <input
 id={inputId}
 className={`${styles.input} ${styles[variant]} ${error ? styles.error : ''}`}
 {...props}
 />
 
 {error && (
 <span className={styles.errorText} role="alert">
 {error}
 </span>
 )}
 
 {helperText && !error && (
 <span className={styles.helperText}>
 {helperText}
 </span>
 )}
 </div>
 );
};

export default Input;