import React from 'react';
import PropTypes from 'prop-types';
import styles from './ConfirmDialog.module.css';
import Modal from './Modal';
import ActionButton from './ActionButton';
import { FaExclamationTriangle, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';

const ConfirmDialog = ({
 isOpen,
 onClose,
 onConfirm,
 title = 'Confirm Action',
 message = 'Are you sure you want to proceed?',
 confirmText = 'Confirm',
 cancelText = 'Cancel',
 variant = 'warning',
 loading = false,
 className = ''
}) => {
 const getVariantConfig = (variant) => {
 const configs = {
 warning: {
 icon: <FaExclamationTriangle />,
 confirmVariant: 'warning'
 },
 danger: {
 icon: <FaTrash />,
 confirmVariant: 'danger'
 },
 success: {
 icon: <FaCheck />,
 confirmVariant: 'success'
 },
 info: {
 icon: <FaExclamationTriangle />,
 confirmVariant: 'primary'
 }
 };

 return configs[variant] || configs.warning;
 };

 const config = getVariantConfig(variant);

 const dialogClasses = [
 styles.confirmDialog,
 styles[variant],
 className
 ].filter(Boolean).join(' ');

 const handleConfirm = () => {
 onConfirm?.();
 };

 const handleCancel = () => {
 if (!loading) {
 onClose?.();
 }
 };

 return (
 <Modal
 isOpen={isOpen}
 onClose={handleCancel}
 size="small"
 closeOnOverlayClick={!loading}
 showCloseButton={false}
 className={dialogClasses}
 >
 <div className={styles.dialogContent}>
 <div className={styles.dialogIcon}>
 {config.icon}
 </div>
 
 <div className={styles.dialogText}>
 <h3 className={styles.dialogTitle}>{title}</h3>
 <p className={styles.dialogMessage}>{message}</p>
 </div>
 </div>

 <div className={styles.dialogActions}>
 <ActionButton
 variant="outline"
 onClick={handleCancel}
 disabled={loading}
 icon={<FaTimes />}
 >
 {cancelText}
 </ActionButton>
 
 <ActionButton
 variant={config.confirmVariant}
 onClick={handleConfirm}
 loading={loading}
 icon={!loading && <FaCheck />}
 >
 {confirmText}
 </ActionButton>
 </div>
 </Modal>
 );
};

ConfirmDialog.propTypes = {
 isOpen: PropTypes.bool.isRequired,
 onClose: PropTypes.func.isRequired,
 onConfirm: PropTypes.func.isRequired,
 title: PropTypes.string,
 message: PropTypes.string,
 confirmText: PropTypes.string,
 cancelText: PropTypes.string,
 variant: PropTypes.oneOf(['warning', 'danger', 'success', 'info']),
 loading: PropTypes.bool,
 className: PropTypes.string
};

export default ConfirmDialog;