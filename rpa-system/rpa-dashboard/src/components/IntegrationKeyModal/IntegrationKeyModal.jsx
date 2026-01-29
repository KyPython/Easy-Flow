import React, { useState } from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('IntegrationKeyModal');
import Modal from '../WorkflowBuilder/Modal';
import styles from './IntegrationKeyModal.module.css';

const IntegrationKeyModal = ({ isOpen, onClose, integration, onConnect }) => {
 const [apiKey, setApiKey] = useState('');
 const [apiSecret, setApiSecret] = useState('');
 const [phoneNumber, setPhoneNumber] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 const handleSubmit = async (e) => {
 e.preventDefault();
 setError('');
 
 if (!apiKey) {
 setError('API Key is required');
 return;
 }

 setLoading(true);
 try {
 const credentials = {
 apiKey,
 ...(apiSecret && { apiSecret }),
 ...(phoneNumber && { phoneNumber })
 };

 await onConnect(credentials);
 // Reset form on success
 setApiKey('');
 setApiSecret('');
 setPhoneNumber('');
 onClose();
 } catch (err) {
 setError(err.message || 'Failed to connect integration');
 } finally {
 setLoading(false);
 }
 };

 const getInstructions = () => {
 switch (integration?.id) {
 case 'whatsapp':
 return {
 title: 'Get Your WhatsApp API Key',
 steps: [
 'Go to Twilio Console (https://console.twilio.com)',
 'Navigate to Account -> API Keys & Tokens',
 'Create a new API Key or use an existing one',
 'Copy the API Key (starts with SK...)',
 'Optionally, copy the API Secret if you have one'
 ],
 helpLink: 'https://www.twilio.com/docs/whatsapp/quickstart',
 helpText: 'Learn more about WhatsApp Business API setup'
 };
 default:
 return {
 title: 'Get Your API Key',
 steps: [
 'Visit the service provider\'s developer console',
 'Create a new API key or access token',
 'Copy the key and paste it below'
 ],
 helpLink: null,
 helpText: null
 };
 }
 };

 const instructions = getInstructions();

 return (
 <Modal isOpen={isOpen} onClose={onClose} title={`Connect ${integration?.name}`}>
 <div className={styles.modalContent}>
 <div className={styles.instructions}>
 <h3 className={styles.instructionsTitle}>{instructions.title}</h3>
 <ol className={styles.stepsList}>
 {instructions.steps.map((step, index) => (
 <li key={index} className={styles.step}>
 {step}
 </li>
 ))}
 </ol>
 {instructions.helpLink && (
 <a
 href={instructions.helpLink}
 target="_blank"
 rel="noopener noreferrer"
 className={styles.helpLink}
 >
 📖 {instructions.helpText}
 </a>
 )}
 </div>

 {error && (
 <div className={styles.error}>
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className={styles.form}>
 <div className={styles.formGroup}>
 <label htmlFor="apiKey">
 API Key <span className={styles.required}>*</span>
 </label>
 <input
 type="password"
 id="apiKey"
 value={apiKey}
 onChange={(e) => setApiKey(e.target.value)}
 placeholder="Enter your API key (e.g., SK...)"
 required
 className={styles.input}
 autoComplete="off"
 />
 <small className={styles.helperText}>
 Your API key will be encrypted and stored securely
 </small>
 </div>

 {integration?.id === 'whatsapp' && (
 <>
 <div className={styles.formGroup}>
 <label htmlFor="apiSecret">API Secret (Optional)</label>
 <input
 type="password"
 id="apiSecret"
 value={apiSecret}
 onChange={(e) => setApiSecret(e.target.value)}
 placeholder="Enter your API secret"
 className={styles.input}
 autoComplete="off"
 />
 <small className={styles.helperText}>
 Required for some WhatsApp providers
 </small>
 </div>

 <div className={styles.formGroup}>
 <label htmlFor="phoneNumber">Phone Number (Optional)</label>
 <input
 type="text"
 id="phoneNumber"
 value={phoneNumber}
 onChange={(e) => setPhoneNumber(e.target.value)}
 placeholder="+1234567890"
 className={styles.input}
 autoComplete="off"
 />
 <small className={styles.helperText}>
 Your WhatsApp Business phone number (with country code)
 </small>
 </div>
 </>
 )}

 <div className={styles.formActions}>
 <button
 type="button"
 onClick={onClose}
 className={styles.btnCancel}
 disabled={loading}
 >
 Cancel
 </button>
 <button
 type="submit"
 className={styles.btnSubmit}
 disabled={loading || !apiKey}
 style={{ background: integration?.color || 'var(--color-primary-600)' }}
 >
 {loading ? 'Connecting...' : 'Connect'}
 </button>
 </div>
 </form>
 </div>
 </Modal>
 );
};

export default IntegrationKeyModal;

