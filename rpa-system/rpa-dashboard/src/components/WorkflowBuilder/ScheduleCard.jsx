import React, { useState } from 'react';
import styles from './ScheduleCard.module.css';
import { 
 FaClock, 
 FaGlobe, 
 FaPlay, 
 FaEdit, 
 FaTrash, 
 FaHistory,
 FaCopy,
 FaToggleOn,
 FaToggleOff
} from 'react-icons/fa';
import ActionButton from './ActionButton';

const ScheduleCard = ({ 
 schedule, 
 onEdit, 
 onDelete, 
 onTrigger, 
 onViewHistory,
 onToggle 
}) => {
 const [isToggling, setIsToggling] = useState(false);

 const getScheduleTypeIcon = (type) => {
 switch (type) {
 case 'cron': return <FaClock />;
 case 'interval': return <FaClock />;
 case 'webhook': return <FaGlobe />;
 default: return <FaClock />;
 }
 };

 const getScheduleDescription = (schedule) => {
 switch (schedule.schedule_type) {
 case 'cron':
 return `Cron: ${schedule.cron_expression} (${schedule.timezone || 'UTC'})`;
 case 'interval':
 return `Every ${schedule.interval_seconds} seconds`;
 case 'webhook':
 return 'Triggered by webhook';
 default:
 return 'Unknown schedule type';
 }
 };

 const formatLastTrigger = (date) => {
 if (!date) return 'Never';
 return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
 };

 const formatNextTrigger = (date) => {
 if (!date) return 'Not scheduled';
 const now = new Date();
 const next = new Date(date);
 const diff = next - now;
 
 if (diff < 0) return 'Overdue';
 
 const minutes = Math.floor(diff / 60000);
 const hours = Math.floor(minutes / 60);
 const days = Math.floor(hours / 24);
 
 if (days > 0) return `In ${days} day${days > 1 ? 's' : ''}`;
 if (hours > 0) return `In ${hours} hour${hours > 1 ? 's' : ''}`;
 if (minutes > 0) return `In ${minutes} minute${minutes > 1 ? 's' : ''}`;
 return 'Soon';
 };

 const handleToggle = async () => {
 if (isToggling) return;
 
 setIsToggling(true);
 try {
 await onToggle?.(schedule.id, !schedule.is_active);
 } finally {
 setIsToggling(false);
 }
 };

 const copyWebhookUrl = () => {
 if (schedule.webhook_url) {
 navigator.clipboard.writeText(schedule.webhook_url);
 }
 };

 return (
 <div className={`${styles.scheduleCard} ${!schedule.is_active ? styles.inactive : ''}`}>
 <div className={styles.cardHeader}>
 <div className={styles.cardTitle}>
 <span className={styles.typeIcon}>
 {getScheduleTypeIcon(schedule.schedule_type)}
 </span>
 <div className={styles.scheduleInfo}>
 <h4 className={styles.scheduleName}>{schedule.name}</h4>
 <p className={styles.scheduleDescription}>
 {getScheduleDescription(schedule)}
 </p>
 </div>
 </div>
 
 <div className={styles.cardActions}>
 <ActionButton
 variant="ghost"
 size="small"
 icon={schedule.is_active ? <FaToggleOn /> : <FaToggleOff />}
 onClick={handleToggle}
 loading={isToggling}
 title={schedule.is_active ? 'Disable schedule' : 'Enable schedule'}
 className={schedule.is_active ? styles.activeToggle : styles.inactiveToggle}
 />
 
 <ActionButton
 variant="ghost"
 size="small"
 icon={<FaPlay />}
 onClick={() => onTrigger?.(schedule.id)}
 title="Run now"
 />
 
 <ActionButton
 variant="ghost"
 size="small"
 icon={<FaEdit />}
 onClick={() => onEdit?.(schedule)}
 title="Edit schedule"
 />
 
 <ActionButton
 variant="ghost"
 size="small"
 icon={<FaTrash />}
 onClick={() => onDelete?.(schedule.id)}
 title="Delete schedule"
 className={styles.deleteButton}
 />
 </div>
 </div>

 <div className={styles.cardContent}>
 <div className={styles.statusRow}>
 <span className={`${styles.statusBadge} ${schedule.is_active ? styles.active : styles.inactive}`}>
 {schedule.is_active ? 'Active' : 'Inactive'}
 </span>
 <span className={styles.executionCount}>
 {schedule.execution_count || 0} executions
 </span>
 </div>

 {/* Webhook URL */}
 {schedule.webhook_url && (
 <div className={styles.webhookInfo}>
 <label className={styles.webhookLabel}>Webhook URL:</label>
 <div className={styles.webhookUrl}>
 <input
 type="text"
 value={schedule.webhook_url}
 readOnly
 className={styles.webhookInput}
 />
 <ActionButton
 variant="ghost"
 size="small"
 icon={<FaCopy />}
 onClick={copyWebhookUrl}
 title="Copy webhook URL"
 />
 </div>
 </div>
 )}

 {/* Schedule Information */}
 <div className={styles.scheduleDetails}>
 <div className={styles.detailItem}>
 <span className={styles.detailLabel}>Last triggered:</span>
 <span className={styles.detailValue}>
 {formatLastTrigger(schedule.last_triggered_at)}
 </span>
 </div>
 
 {schedule.next_trigger_at && (
 <div className={styles.detailItem}>
 <span className={styles.detailLabel}>Next run:</span>
 <span className={styles.detailValue}>
 {formatNextTrigger(schedule.next_trigger_at)}
 </span>
 </div>
 )}
 
 {schedule.max_executions && (
 <div className={styles.detailItem}>
 <span className={styles.detailLabel}>Limit:</span>
 <span className={styles.detailValue}>
 {schedule.execution_count || 0} / {schedule.max_executions}
 </span>
 </div>
 )}
 </div>
 </div>

 <div className={styles.cardFooter}>
 <ActionButton
 variant="outline"
 size="small"
 icon={<FaHistory />}
 onClick={() => onViewHistory?.(schedule)}
 >
 View History
 </ActionButton>
 </div>
 </div>
 );
};

export default ScheduleCard;