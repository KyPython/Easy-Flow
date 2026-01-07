/**
 * Form Persistence Utility
 * Handles automatic saving/restoring of form data using localStorage
 */
import React from 'react';

class FormPersistence {
 constructor(formId, options = {}) {
 this.formId = formId;
 this.options = {
 debounceTime: options.debounceTime || 1000,
 sensitiveFields: options.sensitiveFields || ['password', 'token', 'secret'],
 excludeFields: options.excludeFields || [],
 maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours default
 ...options
 };
 this.storageKey = `form_data_${this.formId}`;
 this.debounceTimeout = null;
 this.isEnabled = this.checkStorageAvailable();
 }

 checkStorageAvailable() {
 try {
 const testKey = '__form_persistence_test__';
 localStorage.setItem(testKey, 'test');
 localStorage.removeItem(testKey);
 return true;
 } catch (e) {
 console.warn('localStorage not available, form persistence disabled');
 return false;
 }
 }

 sanitizeFormData(formData) {
 if (!formData || typeof formData !== 'object') return {};
 
 const sanitized = { ...formData };
 
 // Remove sensitive fields
 this.options.sensitiveFields.forEach(field => {
 delete sanitized[field];
 });
 
 // Remove excluded fields
 this.options.excludeFields.forEach(field => {
 delete sanitized[field];
 });
 
 // Remove null/undefined values for cleaner storage but keep empty strings so
 // components relying on keys (e.g. calling .trim()) receive defined values.
 Object.keys(sanitized).forEach(key => {
 if (sanitized[key] === null || sanitized[key] === undefined) {
 delete sanitized[key];
 }
 });
 
 return sanitized;
 }

 saveFormData(formData) {
 if (!this.isEnabled) return false;
 
 try {
 const sanitized = this.sanitizeFormData(formData);
 const dataToStore = {
 data: sanitized,
 timestamp: Date.now(),
 version: '1.0'
 };
 
 localStorage.setItem(this.storageKey, JSON.stringify(dataToStore));
 return true;
 } catch (error) {
 console.warn('Failed to save form data:', error);
 return false;
 }
 }

 loadFormData() {
 if (!this.isEnabled) return null;
 
 try {
 const stored = localStorage.getItem(this.storageKey);
 if (!stored) return null;
 
 const parsed = JSON.parse(stored);
 
 // Check if data is expired
 if (Date.now() - parsed.timestamp > this.options.maxAge) {
 this.clearFormData();
 return null;
 }
 
 return parsed.data || null;
 } catch (error) {
 console.warn('Failed to load form data:', error);
 this.clearFormData();
 return null;
 }
 }

 debouncedSave(formData) {
 if (!this.isEnabled) return;
 
 clearTimeout(this.debounceTimeout);
 this.debounceTimeout = setTimeout(() => {
 this.saveFormData(formData);
 }, this.options.debounceTime);
 }

 clearFormData() {
 if (!this.isEnabled) return false;
 
 try {
 localStorage.removeItem(this.storageKey);
 return true;
 } catch (error) {
 console.warn('Failed to clear form data:', error);
 return false;
 }
 }

 hasStoredData() {
 return this.loadFormData() !== null;
 }

 getStorageInfo() {
 const data = this.loadFormData();
 if (!data) return null;
 
 const stored = localStorage.getItem(this.storageKey);
 const parsed = JSON.parse(stored);
 
 return {
 hasData: true,
 timestamp: parsed.timestamp,
 age: Date.now() - parsed.timestamp,
 fieldCount: Object.keys(data).length
 };
 }

 destroy() {
 clearTimeout(this.debounceTimeout);
 }
}

/**
 * React Hook for Form Persistence
 */
export const useFormPersistence = (formId, initialFormData = {}, options = {}) => {
 const [persistence] = React.useState(() => new FormPersistence(formId, options));
 const [hasStoredData, setHasStoredData] = React.useState(false);
 const [storageInfo, setStorageInfo] = React.useState(null);

 // Load stored data on mount
 React.useEffect(() => {
 const stored = persistence.loadFormData();
 const info = persistence.getStorageInfo();
 
 setHasStoredData(!!stored);
 setStorageInfo(info);
 
 // Clean up on unmount
 return () => persistence.destroy();
 }, [persistence]);

 const saveData = React.useCallback((formData) => {
 persistence.debouncedSave(formData);
 setHasStoredData(true);
 }, [persistence]);

 const loadData = React.useCallback(() => {
 return persistence.loadFormData() || initialFormData;
 }, [persistence, initialFormData]);

 const clearData = React.useCallback(() => {
 persistence.clearFormData();
 setHasStoredData(false);
 setStorageInfo(null);
 }, [persistence]);

 return {
 saveData,
 loadData,
 clearData,
 hasStoredData,
 storageInfo,
 isEnabled: persistence.isEnabled
 };
};

/**
 * Auto-populate forms from browser credentials when possible
 * This is a basic implementation that works with standard browser autofill
 */
export const enableBrowserAutofill = (formElement, targetUrl = null) => {
 if (!formElement) return;

 // Set autocomplete attributes for better browser integration
 const inputs = formElement.querySelectorAll('input');
 inputs.forEach(input => {
 const name = input.name || input.id;
 if (!name) return;

 // Map common field names to autocomplete values
 const autocompleteMap = {
 'email': 'email',
 'username': 'username',
 'user': 'username', 
 'login': 'username',
 // Note: 'current-password' is an HTML autocomplete value, not an actual password
 'password': 'current-password', // HTML5 autocomplete attribute value
 'url': 'url',
 'website': 'url',
 'target_url': 'url',
 'firstName': 'given-name',
 'lastName': 'family-name',
 'phone': 'tel',
 'company': 'organization'
 };

 const autoCompleteValue = autocompleteMap[name] || autocompleteMap[name.toLowerCase()];
 if (autoCompleteValue) {
 input.setAttribute('autocomplete', autoCompleteValue);
 }
 });

 // Pre-populate URL field if targetUrl provided
 if (targetUrl) {
 const urlInput = formElement.querySelector('input[name="url"], input[name="target_url"], #url');
 if (urlInput && !urlInput.value) {
 urlInput.value = targetUrl;
 
 // Trigger change event
 const event = new Event('change', { bubbles: true });
 urlInput.dispatchEvent(event);
 }
 }
};

export default FormPersistence;