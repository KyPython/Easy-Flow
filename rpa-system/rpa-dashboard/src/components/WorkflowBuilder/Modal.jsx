import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';
import { FaTimes } from 'react-icons/fa';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const modalContent = (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={`${styles.modal} ${styles[size]} ${className}`}>
        {(title || showCloseButton) && (
          <div className={styles.modalHeader}>
            {title && <h2 className={styles.modalTitle}>{title}</h2>}
            {showCloseButton && (
              <button 
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close modal"
              >
                <FaTimes />
              </button>
            )}
          </div>
        )}
        
        <div className={styles.modalContent}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  children: PropTypes.node,
  size: PropTypes.string,
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  className: PropTypes.string
};