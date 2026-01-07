import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { apiErrorHandler } from '../../utils/errorHandler';

const NetworkStatus = ({ showDetails = false }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState(null);
  const [lastCheck, setLastCheck] = useState(new Date());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastCheck(new Date());
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setLastCheck(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get initial error handler status
    setStatus(apiErrorHandler.getStatus());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodically update status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        setStatus(apiErrorHandler.getStatus());
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  if (!showDetails && isOnline) {
    return null; // Don't show anything when online and not in debug mode
  }

  return (
    <div style={{
      position: 'fixed',
      top: isOnline ? 'auto' : 0,
      bottom: isOnline ? 10 : 'auto',
      right: 10,
      zIndex: 9999,
      background: isOnline ? '#28a745' : '#dc3545',
      color: 'white',
      padding: '8px 12px',
      borderRadius: 6,
      fontSize: 12,
      fontFamily: 'system-ui',
      maxWidth: 300,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isOnline ? '#fff' : '#ff6b6b',
          animation: isOnline ? 'none' : 'pulse 2s infinite'
        }} />
        <span style={{ fontWeight: '500' }}>
          {isOnline ? '🌐 Online' : '📡 Offline'}
        </span>
      </div>
      
      {!isOnline && (
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.9 }}>
          Some features may be unavailable
        </div>
      )}

      {showDetails && status && (
        <details style={{ marginTop: 8, fontSize: 11 }}>
          <summary style={{ cursor: 'pointer', opacity: 0.8 }}>
            Debug Info
          </summary>
          <div style={{ marginTop: 4, fontFamily: 'monospace' }}>
            <div>Offline Mode: {status.offlineMode ? 'Yes' : 'No'}</div>
            <div>Cached Endpoints: {status.cachedEndpoints.length}</div>
            <div>Last Check: {lastCheck.toLocaleTimeString()}</div>
            {status.cachedEndpoints.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div>Cached Data:</div>
                {status.cachedEndpoints.map(endpoint => (
                  <div key={endpoint} style={{ marginLeft: 8, opacity: 0.8 }}>
                    * {endpoint}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

NetworkStatus.propTypes = {
  showDetails: PropTypes.bool
};

export default NetworkStatus;