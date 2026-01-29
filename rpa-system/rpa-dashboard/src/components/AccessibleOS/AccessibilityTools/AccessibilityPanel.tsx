import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';
const logger = createLogger('AccessibilityPanel');
import {
 Shield,
 AlertTriangle,
 CheckCircle,
 Info,
 X,
 Play,
 Pause,
} from '../../Icons/Icons';
import {
 auditAccessibility,
 AccessibilityReport,
 AccessibilityMonitor,
} from '../../tools/accessibility-audit';
import Button from '../UI/Button';
import Modal from '../UI/Modal';
import styles from './AccessibilityPanel.module.css';
import { useTheme } from '../../../utils/ThemeContext';

const AccessibilityPanel: React.FC = () => {
 const { theme } = useTheme();
 const [isOpen, setIsOpen] = useState(false);
 const [report, setReport] = useState<AccessibilityReport | null>(null);
 const [isAuditing, setIsAuditing] = useState(false);
 const [isMonitoring, setIsMonitoring] = useState(false);
 const [monitor] = useState(() => new AccessibilityMonitor());

 useEffect(() => {
 return () => {
 monitor.stop();
 };
 }, [monitor]);

 const runAudit = async () => {
 setIsAuditing(true);
 try {
 const auditReport = await auditAccessibility();
 setReport(auditReport);
 } catch (error) {
 logger.error('Accessibility audit failed:', error);
 } finally {
 setIsAuditing(false);
 }
 };

 const toggleMonitoring = () => {
 if (isMonitoring) {
 monitor.stop();
 setIsMonitoring(false);
 } else {
 monitor.start(newReport => {
 setReport(newReport);
 });
 setIsMonitoring(true);
 }
 };

 const getScoreColor = (score: number) => {
 // Use theme colors or fallback to CSS variables
 if (theme?.colors) {
  if (score >= 90) return theme.colors.success || '#10b981';
  if (score >= 70) return theme.colors.warning || '#f59e0b';
  return theme.colors.error || '#ef4444';
 }
 // Fallback to CSS variables
 if (score >= 90) return 'var(--color-success-600, #10b981)';
 if (score >= 70) return 'var(--color-warning-600, #f59e0b)';
 return 'var(--color-error-600, #ef4444)';
 };

 const getImpactIcon = (impact: string) => {
 switch (impact) {
 case 'critical':
 return <AlertTriangle size={16} className={styles.criticalIcon} />;
 case 'serious':
 return <AlertTriangle size={16} className={styles.seriousIcon} />;
 case 'moderate':
 return <Info size={16} className={styles.moderateIcon} />;
 default:
 return <Info size={16} className={styles.minorIcon} />;
 }
 };

 return (
 <>
 {/* Floating accessibility button */}
 <button
 className={styles.floatingButton}
 onClick={() => setIsOpen(true)}
 aria-label="Open accessibility audit panel"
 title="Accessibility Audit"
 >
 <Shield size={24} />
 {report && report.totalIssues > 0 && (
 <span className={styles.badge}>{report.totalIssues}</span>
 )}
 </button>

 <Modal
 isOpen={isOpen}
 onClose={() => setIsOpen(false)}
 title="Accessibility Audit"
 size="lg"
 >
 <div className={styles.panel}>
 <div className={styles.controls}>
 <Button
 variant="primary"
 onClick={runAudit}
 loading={isAuditing}
 disabled={isMonitoring}
 >
 <Play size={16} />
 Run Audit
 </Button>

 <Button
 variant={isMonitoring ? 'danger' : 'secondary'}
 onClick={toggleMonitoring}
 >
 {isMonitoring ? <Pause size={16} /> : <Play size={16} />}
 {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
 </Button>
 </div>

 {report && (
 <div className={styles.report}>
 <div className={styles.scoreSection}>
 <div
 className={styles.scoreCircle}
 style={{ borderColor: getScoreColor(report.score) }}
 >
 <span
 className={styles.score}
 style={{ color: getScoreColor(report.score) }}
 >
 {report.score}
 </span>
 <span className={styles.scoreLabel}>Score</span>
 </div>

 <div className={styles.summary}>
 <div className={styles.summaryItem}>
 <span className={styles.summaryNumber}>
 {report.totalIssues}
 </span>
 <span className={styles.summaryLabel}>Total Issues</span>
 </div>
 <div className={styles.summaryItem}>
 <span className={styles.summaryNumber}>
 {report.criticalIssues}
 </span>
 <span className={styles.summaryLabel}>Critical</span>
 </div>
 <div className={styles.summaryItem}>
 <span className={styles.summaryNumber}>
 {report.seriousIssues}
 </span>
 <span className={styles.summaryLabel}>Serious</span>
 </div>
 <div className={styles.summaryItem}>
 <span className={styles.summaryNumber}>
 {report.moderateIssues}
 </span>
 <span className={styles.summaryLabel}>Moderate</span>
 </div>
 </div>
 </div>

 {report.issues.length > 0 ? (
 <div className={styles.issues}>
 <h3 className="heading-5">Issues Found</h3>
 <div className={styles.issueList}>
 {report.issues.map((issue, index) => (
 <div
 key={index}
 className={`${styles.issue} ${styles[issue.impact]}`}
 >
 <div className={styles.issueHeader}>
 {getImpactIcon(issue.impact)}
 <span className={styles.issueRule}>{issue.rule}</span>
 <span className={styles.wcagBadge}>
 WCAG {issue.wcagLevel} - {issue.wcagCriteria}
 </span>
 </div>

 <div className={styles.issueContent}>
 <p className={styles.issueDescription}>
 {issue.description}
 </p>
 <p className={styles.issueElement}>
 Element: <code>{issue.element}</code>
 </p>
 <p className={styles.issueSuggestion}>
 <strong>Suggestion:</strong> {issue.suggestion}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 ) : (
 <div className={styles.noIssues}>
 <CheckCircle size={48} className={styles.successIcon} />
 <h3>No Accessibility Issues Found!</h3>
 <p>Your application meets accessibility standards.</p>
 </div>
 )}

 <div className={styles.reportFooter}>
 <small className={styles.timestamp}>
 Last audited: {new Date(report.timestamp).toLocaleString()}
 </small>
 </div>
 </div>
 )}

 {!report && !isAuditing && (
 <div className={styles.placeholder}>
 <Shield size={64} className={styles.placeholderIcon} />
 <h3>Accessibility Audit</h3>
 <p>
 Run an audit to check your application's accessibility
 compliance.
 </p>
 </div>
 )}
 </div>
 </Modal>
 </>
 );
};

export default AccessibilityPanel;
