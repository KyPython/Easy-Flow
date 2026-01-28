import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const ToastContext = createContext();

export const useToast = () => {
 const context = useContext(ToastContext);
 if (!context) {
 throw new Error('useToast must be used within a ToastProvider');
 }
 return context;
};

export const ToastProvider = ({ children }) => {
 const [toasts, setToasts] = useState([]);

 const addToast = useCallback((message, type = 'info', duration = 5000) => {
 const id = Date.now() + Math.random();
 const toast = { id, message, type, duration };
 
 setToasts(prev => [...prev, toast]);

 if (duration > 0) {
 setTimeout(() => {
 removeToast(id);
 }, duration);
 }

 return id;
 }, []);

 const removeToast = useCallback((id) => {
 setToasts(prev => prev.filter(toast => toast.id !== id));
 }, []);

 const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast]);
 const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast]);
 const warning = useCallback((message, duration) => addToast(message, 'warning', duration), [addToast]);
 const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast]);

 const value = {
 success,
 error,
 warning,
 info,
 removeToast
 };

 return (
 <ToastContext.Provider value={value}>
 {children}
 <ToastContainer toasts={toasts} onRemove={removeToast} />
 </ToastContext.Provider>
 );
};

const ToastContainer = ({ toasts, onRemove }) => {
 if (toasts.length === 0) return null;

 return createPortal(
 <div className={styles.toastContainer}>
 {toasts.map(toast => (
 <Toast
 key={toast.id}
 toast={toast}
 onRemove={() => onRemove(toast.id)}
 />
 ))}
 </div>,
 document.body
 );
};

const Toast = ({ toast, onRemove }) => {
 const getIcon = (type) => {
 switch (type) {
 case 'success': return <FaCheckCircle />;
 case 'error': return <FaExclamationTriangle />;
 case 'warning': return <FaExclamationTriangle />;
 case 'info': return <FaInfoCircle />;
 default: return <FaInfoCircle />;
 }
 };

 const toastClasses = [
 styles.toast,
 styles[toast.type]
 ].join(' ');

 return (
 <div className={toastClasses}>
 <div className={styles.toastContent}>
 <span className={styles.toastIcon}>
 {getIcon(toast.type)}
 </span>
 <span className={styles.toastMessage}>
 {toast.message}
 </span>
 </div>
 
 <button
 className={styles.toastClose}
 onClick={onRemove}
 aria-label="Close notification"
 >
 <FaTimes />
 </button>
 </div>
 );
};

// PropTypes
ToastProvider.propTypes = {
 children: PropTypes.node.isRequired
};

ToastContainer.propTypes = {
 toasts: PropTypes.array.isRequired,
 onRemove: PropTypes.func.isRequired
};

Toast.propTypes = {
 toast: PropTypes.shape({
 id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
 message: PropTypes.string.isRequired,
 type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired
 }).isRequired,
 onRemove: PropTypes.func.isRequired
};