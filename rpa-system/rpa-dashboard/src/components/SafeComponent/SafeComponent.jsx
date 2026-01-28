import React, { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * Higher-Order Component that wraps components with error boundaries
 * and provides graceful fallbacks for network failures
 */

class SafeComponentWrapper extends Component {
 constructor(props) {
 super(props);
 this.state = {
 hasError: false,
 error: null,
 retryCount: 0
 };
 }

 static getDerivedStateFromError(error) {
 return { hasError: true, error };
 }

 componentDidCatch(error, errorInfo) {
 const { componentName = 'Unknown' } = this.props;
 
 console.warn(`[SafeComponent:${componentName}] Error caught:`, {
 error: error.message,
 component: componentName,
 retryCount: this.state.retryCount
 });

 // Track component-level errors
 if (window.gtag) {
 window.gtag('event', 'component_error', {
 component_name: componentName,
 error_message: error.message,
 retry_count: this.state.retryCount
 });
 }

 this.setState({ error });
 }

 handleRetry = () => {
 console.log(`[SafeComponent] Retrying ${this.props.componentName}`);
 this.setState({
 hasError: false,
 error: null,
 retryCount: this.state.retryCount + 1
 });
 };

 isNetworkError = (error) => {
 const networkKeywords = ['network', 'fetch', 'connection', 'econnrefused', 'timeout'];
 const errorMsg = (error?.message || '').toLowerCase();
 return networkKeywords.some(keyword => errorMsg.includes(keyword));
 };

 render() {
 if (this.state.hasError) {
 const { fallback: Fallback, componentName = 'Component' } = this.props;
 const isNetworkError = this.isNetworkError(this.state.error);

 // Use custom fallback if provided
 if (Fallback) {
 return (
 <Fallback
 error={this.state.error}
 retry={this.handleRetry}
 isNetworkError={isNetworkError}
 componentName={componentName}
 />
 );
 }

 // Default fallback UI
 return (
 <div style={{
 padding: 16,
 margin: 8,
 border: '1px solid #ffd700',
 borderRadius: 6,
 background: '#fffbf0',
 color: '#856404'
 }}>
 <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
 <span style={{ marginRight: 8 }}>⚠️</span>
 <strong>{componentName} Unavailable</strong>
 </div>
 <p style={{ margin: 0, fontSize: 14 }}>
 {isNetworkError 
 ? 'This feature is temporarily unavailable due to connection issues.'
 : 'This component encountered an error and has been disabled.'
 }
 </p>
 {isNetworkError && (
 <button
 onClick={this.handleRetry}
 style={{
 marginTop: 8,
 padding: '6px 12px',
 background: '#007AFF',
 color: 'white',
 border: 'none',
 borderRadius: 4,
 fontSize: 12,
 cursor: 'pointer'
 }}
 >
 Try Again
 </button>
 )}
 </div>
 );
 }

 return this.props.children;
 }
}

SafeComponentWrapper.propTypes = {
 children: PropTypes.node.isRequired,
 componentName: PropTypes.string,
 fallback: PropTypes.elementType
};

/**
 * HOC factory function
 */
export function withSafeComponent(WrappedComponent, options = {}) {
 const {
 componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component',
 fallback = null
 } = options;

 const SafeComponent = (props) => (
 <SafeComponentWrapper
 componentName={componentName}
 fallback={fallback}
 >
 <WrappedComponent {...props} />
 </SafeComponentWrapper>
 );

 SafeComponent.displayName = `Safe(${componentName})`;
 
 return SafeComponent;
}

/**
 * Component wrapper for use in JSX
 */
export const SafeComponent = ({ 
 children, 
 name = 'Component', 
 fallback = null,
 onError = null
}) => {
 return (
 <SafeComponentWrapper
 componentName={name}
 fallback={fallback}
 onError={onError}
 >
 {children}
 </SafeComponentWrapper>
 );
};

SafeComponent.propTypes = {
 children: PropTypes.node.isRequired,
 name: PropTypes.string,
 fallback: PropTypes.elementType,
 onError: PropTypes.func
};

export default SafeComponent;