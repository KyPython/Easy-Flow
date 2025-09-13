import React from 'react';
import PropTypes from 'prop-types';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log for remote debugging (console visible via remote inspect on mobile)
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorBoundary]', error, info);
    this.setState({ info });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
  <div style={{ padding: 24, fontFamily: 'system-ui', color: 'var(--text-primary)' }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p style={{ marginTop: 8 }}>The app encountered a runtime error and stopped rendering.</p>
          {this.state.error && (
            <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--color-gray-100)', padding: 12, borderRadius: 6, maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          )}
          <button onClick={this.handleReload} style={{ marginTop: 16, padding: '8px 14px', background: 'var(--color-primary-600)', color: 'var(--on-primary)', border: 'none', borderRadius: 4 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node
};
