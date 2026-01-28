import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/ThemeContext';
import styles from './ExecutionModeSelector.module.css';

/**
 * Execution Mode Selector Component
 * 
 * Allows users to choose execution mode for workflow:
 * - Real-Time (Instant): Fast execution, higher cost
 * - Balanced: Standard performance and cost
 * - Eco (Scheduled): Cost-optimized, lower cost, higher latency
 * 
 * Shows cost comparison and savings information
 */
const ExecutionModeSelector = ({ 
 workflow, 
 selectedMode, 
 onModeChange, 
 costComparison = null 
}) => {
 const { theme } = useTheme();
 const [localMode, setLocalMode] = useState(selectedMode || 'balanced');
 const [showCostDetails, setShowCostDetails] = useState(false);

 useEffect(() => {
 if (selectedMode) {
 setLocalMode(selectedMode);
 }
 }, [selectedMode]);

 const handleModeChange = (mode) => {
 setLocalMode(mode);
 if (onModeChange) {
 onModeChange(mode);
 }
 };

 const modes = [
 {
 id: 'real-time',
 name: 'Instant',
 description: 'Fast execution for immediate results',
 cost: '$0.004',
 savings: null,
 icon: '⚡',
 tier: 'instant'
 },
 {
 id: 'balanced',
 name: 'Balanced',
 description: 'Standard performance and cost',
 cost: '$0.0035',
 savings: '12.5%',
 icon: '⚖️',
 tier: 'balanced'
 },
 {
 id: 'eco',
 name: 'Scheduled',
 description: 'Cost-optimized for batch jobs',
 cost: '$0.003',
 savings: '20%',
 icon: '💰',
 tier: 'scheduled'
 }
 ];

 return (
 <div className={styles.executionModeSelector} data-theme={theme}>
 <div className={styles.header}>
 <h3 className={styles.title}>💰 Choose Your Execution Mode</h3>
 <p style={{ 
 fontSize: 'var(--font-size-sm)', 
 color: 'var(--text-muted)', 
 marginTop: 'var(--spacing-xs)',
 marginBottom: 'var(--spacing-md)'
 }}>
 Save up to 25% on workflow costs by selecting the right mode for your needs
 </p>
 <button
 className={styles.toggleButton}
 onClick={() => setShowCostDetails(!showCostDetails)}
 aria-label="Toggle cost details"
 >
 {showCostDetails ? '−' : '+'} Cost Details
 </button>
 </div>

 <div className={styles.modes}>
 {modes.map((mode) => (
 <label
 key={mode.id}
 className={`${styles.modeOption} ${localMode === mode.id ? styles.selected : ''}`}
 data-theme={theme}
 >
 <input
 type="radio"
 name="executionMode"
 value={mode.id}
 checked={localMode === mode.id}
 onChange={() => handleModeChange(mode.id)}
 className={styles.radioInput}
 />
 <div className={styles.modeContent}>
 <div className={styles.modeHeader}>
 <span className={styles.modeIcon}>{mode.icon}</span>
 <span className={styles.modeName}>{mode.name}</span>
 {mode.savings && (
 <span className={styles.savingsBadge}>
 Save {mode.savings}
 </span>
 )}
 </div>
 <p className={styles.modeDescription}>{mode.description}</p>
 <div className={styles.modeCost}>
 <span className={styles.costLabel}>Cost per run:</span>
 <span className={styles.costValue}>{mode.cost}</span>
 </div>
 </div>
 </label>
 ))}
 </div>

 {showCostDetails && costComparison && (
 <div className={styles.costDetails} data-theme={theme}>
 <h4>Cost Comparison</h4>
 <div className={styles.comparisonTable}>
 {costComparison.map((mode) => (
 <div key={mode.mode} className={styles.comparisonRow}>
 <span className={styles.comparisonMode}>{mode.tier}</span>
 <span className={styles.comparisonCost}>
 ${parseFloat(mode.costPerExecution).toFixed(4)}
 </span>
 {mode.savingsPercentage !== '0%' && (
 <span className={styles.comparisonSavings}>
 Save {mode.savingsPercentage}
 </span>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {localMode === 'eco' && (
 <div className={styles.ecoInfo} data-theme={theme}>
 <p className={styles.ecoNote}>
 💡 <strong>Scheduled mode</strong> batches workflows during off-peak hours
 to reduce costs by up to 25%. Execution may be delayed by up to 15 minutes, but you'll save significantly on compute costs.
 </p>
 </div>
 )}
 
 <div style={{
 marginTop: 'var(--spacing-md)',
 padding: 'var(--spacing-md)',
 background: 'var(--color-primary-50)',
 borderRadius: 'var(--radius-md)',
 fontSize: 'var(--font-size-sm)',
 color: 'var(--text-muted)'
 }}>
 <strong>💡 Smart Scheduling:</strong> EasyFlow automatically selects the best mode based on your workflow's context. 
 User-triggered workflows use Instant mode, scheduled workflows use Scheduled mode, and everything else uses Balanced mode.
 </div>
 </div>
 );
};

export default ExecutionModeSelector;

