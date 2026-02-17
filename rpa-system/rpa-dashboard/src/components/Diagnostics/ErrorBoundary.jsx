import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeErrorMessage } from '../../utils/errorMessages';

export default class ErrorBoundary extends React.Component {
 constructor(props) {
 super(props);
 this.state = { 
 hasError: false, 
 error: null, 
 info: null,
 errorCount: 0,
 lastErrorTime: null,
 showDetails: false
 };
 }

 static getDerivedStateFromError(error) {
 return { hasError: true, error };
 }

 componentDidCatch(error, info) {
 const now = Date.now();
 const errorCount = this.state.errorCount + 1;
 
 // Log for remote debugging (console visible via remote inspect on mobile)
 console.error('[GlobalErrorBoundary] Error caught:', {
 error: error.message,
 stack: error.stack,
 componentStack: info.componentStack,
 errorCount,
 timestamp: new Date().toISOString()
 });

 // Track error patterns
 if (error.message?.includes('Network Error') || 
 error.message?.includes('ECONNREFUSED') ||
 error.message?.includes('fetch')) {
 console.warn('[ErrorBoundary] Network-related error detected. App should continue functioning.');
 }

 // Store error analytics
 if (window.gtag) {
 window.gtag('event', 'exception', {
 description: error.message,
 fatal: false,
 error_count: errorCount
 });
 }

 this.setState({ 
 info, 
 errorCount,
 lastErrorTime: now
 });

 // Auto-recovery attempt for network errors
 if (this.isNetworkError(error)) {
 setTimeout(() => {
 this.attemptRecovery();
 }, 3000);
 }
 }

	isNetworkError(error) {
		const networkKeywords = ['network', 'fetch', 'connection', 'econnrefused', 'timeout'];
		const errorMsg = (error && error.message) ? String(error.message).toLowerCase() : '';
		return networkKeywords.some(keyword => errorMsg.includes(keyword));
	}

	attemptRecovery() {
		console.log('[ErrorBoundary] Attempting auto-recovery from network error...');
		this.setState({
			hasError: false,
			error: null,
			info: null
		});
	}

	handleReload() {
		// Clear any cached error states
		localStorage.removeItem('app_error_state');
		window.location.reload();
	}

	handleRetry() {
		console.log('[ErrorBoundary] Manual retry initiated');
		this.setState({
			hasError: false,
			error: null,
			info: null
		});
	}

	toggleDetails() {
		this.setState({ showDetails: !this.state.showDetails });
	}

 render() {
 if (this.state.hasError) {
 const isNetworkError = this.isNetworkError(this.state.error);
 
 return (
 <div style={{ 
 padding: 24, 
 fontFamily: 'system-ui', 
 color: 'var(--text-primary)',
 maxWidth: 600,
 margin: '40px auto',
 background: 'var(--color-surface)',
 borderRadius: 8,
 border: '1px solid var(--color-border)'
 }}>
 <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
 <div style={{ 
 width: 24, 
 height: 24, 
 borderRadius: '50%', 
 background: isNetworkError ? '#ff9500' : '#ff3b30',
 marginRight: 12,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 color: 'white',
 fontSize: 14,
 fontWeight: 'bold'
 }}>
 {isNetworkError ? '⚠' : '✗'}
 </div>
 <h1 style={{ fontSize: 20, margin: 0 }}>
 {isNetworkError ? 'Connection Issue' : 'Something went wrong'}
 </h1>
 </div>

 <p style={{ marginBottom: 16, lineHeight: 1.5 }}>
 {isNetworkError ? (
 <>The app lost connection to the server, but you can continue using offline features. 
 We&apos;ll automatically retry the connection.</>
 ) : (
 <>The app encountered an unexpected error. Don&apos;t worry - your data is safe.</>
 )}
 </p>

 {isNetworkError && (
 <div style={{ 
 background: '#fff3cd', 
 border: '1px solid #ffeaa7',
 borderRadius: 6,
 padding: 12,
 marginBottom: 16,
 fontSize: 14
 }}>
 <strong>💡 Tip:</strong> Check your internet connection or try refreshing the page.
 </div>
 )}

 <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
 {isNetworkError ? (
 <button 
 onClick={this.handleRetry} 
 style={{ 
 padding: '10px 16px', 
 background: '#007AFF', 
 color: 'white', 
 border: 'none', 
 borderRadius: 6,
 cursor: 'pointer',
 fontWeight: '500'
 }}
 >
 Try Again
 </button>
 ) : null}
 
 <button 
 onClick={this.handleReload} 
 style={{ 
 padding: '10px 16px', 
 background: 'var(--color-primary-600)', 
 color: 'white', 
 border: 'none', 
 borderRadius: 6,
 cursor: 'pointer',
 fontWeight: '500'
 }}
 >
 Reload App
 </button>

 <button 
 onClick={this.toggleDetails} 
 style={{ 
 padding: '10px 16px', 
 background: 'transparent', 
 color: 'var(--text-secondary)', 
 border: '1px solid var(--color-border)', 
 borderRadius: 6,
 cursor: 'pointer'
 }}
 >
 {this.state.showDetails ? 'Hide' : 'Show'} Details
 </button>
 </div>

 {this.state.showDetails && this.state.error && (
 <details style={{ marginTop: 16 }}>
 <summary style={{ cursor: 'pointer', marginBottom: 8, fontWeight: '500' }}>
 Error Details
 </summary>
 <pre style={{ 
 whiteSpace: 'pre-wrap', 
 background: 'var(--color-gray-100)', 
 padding: 12, 
 borderRadius: 6, 
 maxHeight: 200, 
 overflow: 'auto', 
 fontSize: 12,
 border: '1px solid var(--color-border)'
 }}>
 {/* Show raw error in details (for developers) */}
 {String(this.state.error?.message || this.state.error)}
 {this.state.info?.componentStack && (
 `\n\nComponent Stack:${this.state.info.componentStack}`
 )}
 </pre>
 <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
 Error #{this.state.errorCount} * {new Date(this.state.lastErrorTime).toLocaleString()}
 </div>
 </details>
 )}

 {isNetworkError && (
 <div style={{ 
 marginTop: 16, 
 padding: 12, 
 background: 'var(--color-surface-secondary)',
 borderRadius: 6,
 fontSize: 12,
 color: 'var(--text-secondary)'
 }}>
 <div><strong>Status:</strong> Offline mode active</div>
 <div><strong>Last sync:</strong> {new Date().toLocaleTimeString()}</div>
 </div>
 )}
 </div>
 );
 }
 return this.props.children;
 }
}

ErrorBoundary.propTypes = {
 children: PropTypes.node
};
