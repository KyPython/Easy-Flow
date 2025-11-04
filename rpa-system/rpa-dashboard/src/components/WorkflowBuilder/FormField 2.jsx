import React from 'react';
import styles from './FormField.module.css';

const FormField = ({
  label,
  children,
  error,
  required = false,
  helpText,
  className = '',
  ...props
}) => {
  const fieldClasses = [
    styles.formField,
    error && styles.hasError,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={fieldClasses}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      <div className={styles.fieldContainer}>
        {children}
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {helpText && !error && (
        <div className={styles.helpText}>
          {helpText}
        </div>
      )}
    </div>
  );
};

// Input component
export const Input = ({ 
  type = 'text', 
  className = '', 
  error,
  ...props 
}) => {
  const inputClasses = [
    styles.input,
    error && styles.inputError,
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      type={type}
      className={inputClasses}
      {...props}
    />
  );
};

// Textarea component
export const Textarea = ({ 
  className = '', 
  error,
  rows = 3,
  ...props 
}) => {
  const textareaClasses = [
    styles.textarea,
    error && styles.inputError,
    className
  ].filter(Boolean).join(' ');

  return (
    <textarea
      rows={rows}
      className={textareaClasses}
      {...props}
    />
  );
};

// Select component
export const Select = ({ 
  children, 
  className = '', 
  error,
  ...props 
}) => {
  const selectClasses = [
    styles.select,
    error && styles.inputError,
    className
  ].filter(Boolean).join(' ');

  return (
    <select
      className={selectClasses}
      {...props}
    >
      {children}
    </select>
  );
};

// Checkbox component
export const Checkbox = ({ 
  label, 
  className = '', 
  ...props 
}) => {
  const checkboxClasses = [
    styles.checkboxContainer,
    className
  ].filter(Boolean).join(' ');

  return (
    <label className={checkboxClasses}>
      <input
        type="checkbox"
        className={styles.checkbox}
        {...props}
      />
      <span className={styles.checkboxLabel}>{label}</span>
    </label>
  );
};

export default FormField;