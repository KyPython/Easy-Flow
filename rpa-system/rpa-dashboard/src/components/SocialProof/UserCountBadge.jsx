import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSocialProof } from '../../hooks/useSocialProof';

export default function UserCountBadge({ variant = 'join', className = '' }) {
  const { data, loading, error } = useSocialProof();
  const [displayCount, setDisplayCount] = useState(data.totalUsers);

  // Animate counter with smooth transitions (Tailwind-style)
  useEffect(() => {
    if (!loading && data.totalUsers !== displayCount) {
      const duration = 1200;
      const steps = 30;
      const increment = (data.totalUsers - displayCount) / steps;
      let current = displayCount;

      const timer = setInterval(() => {
        current += increment;
        if (increment > 0 ? current >= data.totalUsers : current <= data.totalUsers) {
          setDisplayCount(data.totalUsers);
          clearInterval(timer);
        } else {
          setDisplayCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [data.totalUsers, loading, displayCount]);

  const text = variant === 'join' 
    ? `Join ${displayCount.toLocaleString()}+ users automating workflows`
    : `Trusted by ${displayCount.toLocaleString()}+ professionals`;

  return (
    <div 
      className={`user-count-badge ${loading ? 'opacity-80' : 'opacity-100'} ${className}`} 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '24px',
        fontSize: '14px',
        color: '#374151',
        fontWeight: '500',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Tailwind ease-out
        cursor: 'default',
        fontVariantNumeric: 'tabular-nums'
      }}
      title={error ? `Error: ${error}` : `Last updated: ${new Date(data.lastUpdated).toLocaleString()}`}
    >
      <PulseDot loading={loading} error={!!error} />
      <span style={{
        transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {text}
      </span>
    </div>
  );
}

UserCountBadge.propTypes = {
  variant: PropTypes.oneOf(['join', 'trusted']),
  className: PropTypes.string
};

function PulseDot({ loading, error }) {
  const color = error ? '#ef4444' : loading ? '#94a3b8' : '#10b981';
  const animation = loading || error ? 'none' : 'pulse 2s ease-in-out infinite';

  return (
    <span style={{
      display: 'inline-flex',
      width: '8px',
      height: '8px',
      backgroundColor: color,
      borderRadius: '50%',
      animation,
      transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0%, 100% { 
              opacity: 1; 
              transform: scale(1); 
            }
            50% { 
              opacity: 0.6; 
              transform: scale(1.05); 
            }
          }
        `
      }} />
    </span>
  );
}

PulseDot.propTypes = {
  loading: PropTypes.bool,
  error: PropTypes.bool
};