import React, { useState } from 'react';
import Modal from '../WorkflowBuilder/Modal';
import styles from './IntegrationKeyModal.module.css';

const IntegrationKeyModal = ({ isOpen, onClose, integration, onConnect }) => {
 const [apiKey, setApiKey] = useState('');
 const [apiSecret, setApiSecret] = useState('');
 const [phoneNumber, setPhoneNumber] = useState('');
 // Airtable fields
 const [baseId, setBaseId] = useState('');
 const [tableName, setTableName] = useState('');
 // Trello fields
 const [trelloKey, setTrelloKey] = useState('');
 const [trelloToken, setTrelloToken] = useState('');
 const [listId, setListId] = useState('');

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 const handleSubmit = async (e) => {
 e.preventDefault();
 setError('');
 
 let credentials = {};
 if (integration?.id === 'airtable') {
   if (!apiKey || !baseId || !tableName) {
     setError('API Key, Base ID, and Table Name are required');
     return;
   }
   credentials = { apiKey, baseId, tableName };
 } else if (integration?.id === 'trello') {
   if (!trelloKey || !trelloToken || !listId) {
     setError('API Key, Token, and List ID are required');
     return;
   }
   credentials = { key: trelloKey, token: trelloToken, listId };
 } else {
   if (!apiKey) {
     setError('API Key is required');
     return;
   }
   credentials = {
     apiKey,
     ...(apiSecret && { apiSecret }),
     ...(phoneNumber && { phoneNumber })
   };
 }

 setLoading(true);
 try {
 await onConnect(credentials);
 // Reset form on success
 setApiKey('');
 setApiSecret('');
 setPhoneNumber('');
 setBaseId('');
 setTableName('');
 setTrelloKey('');
 setTrelloToken('');
 setListId('');
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
                    'Navigate to Account → API Keys & Tokens',
 'Create a new API Key or use an existing one',
 'Copy the API Key (starts with SK...)',
 'Optionally, copy the API Secret if you have one'
 ],
 helpLink: 'https://www.twilio.com/docs/whatsapp/quickstart',
 helpText: 'Learn more about WhatsApp Business API setup'
 };
 case 'airtable':
 return {
 title: 'Connect Airtable via API Key',
 steps: [
 'Go to Airtable Account (https://airtable.com/account)',
 'Generate a Personal Access Token with read/write to target base',
 'Find your Base ID from the Airtable API docs (https://airtable.com/developers/web/api/introduction)',
 'Enter the Table Name where records should be created'
 ],
 helpLink: 'https://airtable.com/developers/web/api/introduction',
 helpText: 'Airtable API guide'
 };
 case 'trello':
 return {
 title: 'Connect Trello via API Key & Token',
 steps: [
 'Get API Key: https://trello.com/app-key',
 'Generate a Token on the same page (grant write access)',
 'Find your List ID using the Trello API or browser dev tools'
 ],
 helpLink: 'https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/',
 helpText: 'Trello API guide'
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
  {integration?.id !== 'trello' && (
    <div className={styles.formGroup}>
      <label htmlFor="apiKey">
        API Key <span className={styles.required}>*</span>
      </label>
      <input
        type="password"
        id="apiKey"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={integration?.id === 'airtable' ? 'Airtable Personal Access Token' : 'Enter your API key'}
        required={integration?.id !== 'trello'}
        className={styles.input}
        autoComplete="off"
      />
      <small className={styles.helperText}>
        Your API key will be encrypted and stored securely
      </small>
    </div>
  )}

  {integration?.id === 'airtable' && (
    <>
      <div className={styles.formGroup}>
        <label htmlFor="baseId">Base ID <span className={styles.required}>*</span></label>
        <input
          type="text"
          id="baseId"
          value={baseId}
          onChange={(e) => setBaseId(e.target.value)}
          placeholder="appXXXXXXXXXXXXXX"
          className={styles.input}
          autoComplete="off"
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="tableName">Table Name <span className={styles.required}>*</span></label>
        <input
          type="text"
          id="tableName"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="e.g., Contacts"
          className={styles.input}
          autoComplete="off"
          required
        />
      </div>
    </>
  )}

  {integration?.id === 'trello' && (
    <>
      <div className={styles.formGroup}>
        <label htmlFor="trelloKey">API Key <span className={styles.required}>*</span></label>
        <input
          type="password"
          id="trelloKey"
          value={trelloKey}
          onChange={(e) => setTrelloKey(e.target.value)}
          placeholder="Enter your Trello API key"
          className={styles.input}
          autoComplete="off"
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="trelloToken">Token <span className={styles.required}>*</span></label>
        <input
          type="password"
          id="trelloToken"
          value={trelloToken}
          onChange={(e) => setTrelloToken(e.target.value)}
          placeholder="Enter your Trello token"
          className={styles.input}
          autoComplete="off"
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="listId">List ID <span className={styles.required}>*</span></label>
        <input
          type="text"
          id="listId"
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          placeholder="e.g., 5abbe4b7f6e2c5b3e10c5f24"
          className={styles.input}
          autoComplete="off"
          required
        />
      </div>
    </>
  )}

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
      disabled={loading || (integration?.id === 'trello' ? (!trelloKey || !trelloToken || !listId) : !apiKey)}
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

