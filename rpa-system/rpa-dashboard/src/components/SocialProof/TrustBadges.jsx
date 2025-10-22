import React from 'react';

export default function TrustBadges({ className = '', variant = 'horizontal' }) {
  const badges = [
    { icon: '✓', text: 'No credit card required', enabled: true },
    { icon: '✓', text: 'Cancel anytime', enabled: true },
    { icon: '✓', text: 'Free trial available', enabled: true },
    { icon: '🔒', text: 'Secure & private', enabled: true }
  ];

  const enabledBadges = badges.filter(b => b.enabled);

  const containerStyle = {
    display: 'flex',
    flexDirection: variant === 'vertical' ? 'column' : 'row',
    gap: variant === 'vertical' ? '8px' : '16px',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap'
  };

  const badgeStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '16px',
    fontSize: '13px',
    color: '#047857',
    fontWeight: '500',
    whiteSpace: 'nowrap'
  };

  const iconStyle = {
    fontSize: '12px',
    fontWeight: 'bold'
  };

  return (
    <div className={`trust-badges ${className}`} style={containerStyle}>
      {enabledBadges.map((badge, idx) => (
        <div key={idx} style={badgeStyle}>
          <span style={iconStyle}>{badge.icon}</span>
          <span>{badge.text}</span>
        </div>
      ))}
    </div>
  );
}