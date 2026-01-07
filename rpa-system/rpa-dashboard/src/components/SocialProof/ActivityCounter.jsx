import React, { useState, useEffect } from 'react';
import { useSocialProof } from '../../hooks/useSocialProof';

export default function ActivityCounter({ className = '' }) {
 const { data, loading, error } = useSocialProof();
 
 // Only show if there's meaningful activity
 const hasActivity = data.activeWorkflows > 0 || data.recentEvents > 0 || data.totalUsers > 0;
 
 if (!hasActivity) {
 return null;
 }

 const stats = [
 {
 value: data.totalUsers,
 label: 'total users',
 icon: '👥',
 show: data.totalUsers > 0
 },
 {
 value: data.activeWorkflows,
 label: 'active workflows',
 icon: '🔄',
 show: data.activeWorkflows > 0
 },
 {
 value: data.recentEvents,
 label: 'events this week',
 icon: '⚡',
 show: data.recentEvents > 0
 }
 ].filter(stat => stat.show);

 return (
 <div 
 className={`activity-counter ${loading ? 'opacity-90' : 'opacity-100'} ${className}`} 
 style={{
 display: 'flex',
 gap: '32px',
 padding: '24px',
 backgroundColor: error ? 'rgba(254, 242, 242, 0.8)' : '#f9fafb',
 borderRadius: '12px',
 border: `1px solid ${error ? '#fecaca' : '#e5e7eb'}`,
 fontSize: '14px',
 justifyContent: 'center',
 margin: '20px 0',
 transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
 flexWrap: 'wrap'
 }}
 title={error ? `Error: ${error}` : `Last updated: ${new Date(data.lastUpdated).toLocaleString()}`}
 >
 {stats.map((stat, index) => (
 <ActivityStat 
 key={stat.label}
 value={stat.value} 
 label={stat.label}
 icon={stat.icon}
 loading={loading}
 error={error}
 index={index} // For staggered animations
 />
 ))}
 </div>
 );
}

function ActivityStat({ value, label, icon, loading, error, index = 0 }) {
 const [displayValue, setDisplayValue] = useState(value);

 useEffect(() => {
 if (value !== displayValue && !loading) {
 const delay = index * 100; // Stagger animations by 100ms
 const duration = 1500;
 const steps = 30;
 
 setTimeout(() => {
 const increment = (value - displayValue) / steps;
 let current = displayValue;

 const timer = setInterval(() => {
 current += increment;
 if (increment > 0 ? current >= value : current <= value) {
 setDisplayValue(value);
 clearInterval(timer);
 } else {
 setDisplayValue(Math.floor(current));
 }
 }, duration / steps);
 }, delay);
 }
 }, [value, loading, displayValue, index]);

 return (
 <div 
 style={{
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 gap: '8px',
 textAlign: 'center',
 minWidth: '90px',
 opacity: error ? 0.7 : 1,
 transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
 }}
 >
 <div style={{
 fontSize: '28px',
 fontWeight: 'bold',
 color: error ? '#dc2626' : loading ? '#94a3b8' : '#1f2937',
 display: 'flex',
 alignItems: 'center',
 gap: '10px',
 transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
 fontVariantNumeric: 'tabular-nums'
 }}>
 <span style={{
 fontSize: '22px',
 opacity: loading ? 0.6 : 1,
 transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
 transform: loading ? 'scale(0.95)' : 'scale(1)'
 }}>
 {icon}
 </span>
 <CountUp 
 value={displayValue} 
 loading={loading}
 error={error}
 />
 </div>
 <div style={{
 fontSize: '13px',
 color: error ? '#dc2626' : loading ? '#94a3b8' : '#6b7280',
 fontWeight: '500',
 transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
 letterSpacing: '0.025em'
 }}>
 {label}
 </div>
 </div>
 );
}

function CountUp({ value, loading, error }) {
 return (
 <span style={{
 fontVariantNumeric: 'tabular-nums',
 transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
 transform: loading ? 'translateY(1px)' : 'translateY(0)',
 opacity: error ? 0.8 : 1
 }}>
 {value.toLocaleString()}
 </span>
 );
}