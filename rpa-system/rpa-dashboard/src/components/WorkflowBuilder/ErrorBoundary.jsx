import React from 'react';
import styles from './ErrorBoundary.module.css';
import { FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import ActionButton from './ActionButton';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // You could also log the error to an error reporting service here
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { title = 'Something went wrong', message, showDetails = false } = this.props;

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>
              <FaExclamationTriangle />
            </div>
            
            <h2 className={styles.errorTitle}>{title}</h2>
            
            <p className={styles.errorMessage}>
              {message || 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'}
            </p>

            <div className={styles.errorActions}>
              <ActionButton
                variant="primary"
                icon={<FaRedo />}
                onClick={this.handleRetry}
              >
                Try Again
              </ActionButton>
              
              <ActionButton
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </ActionButton>
            </div>

            {showDetails && this.state.error && (
              <details className={styles.errorDetails}>
                <summary>Error Details</summary>
                <pre className={styles.errorStack}>
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;