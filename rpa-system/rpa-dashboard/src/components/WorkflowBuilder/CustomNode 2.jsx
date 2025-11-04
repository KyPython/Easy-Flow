import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Handle, Position } from 'reactflow';
import styles from './CustomNode.module.css';
import { 
  FaPlay, 
  FaStop, 
  FaCog, 
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock
} from 'react-icons/fa';

const CustomNode = ({ data, selected }) => {
  // Guard against undefined data to avoid runtime errors during fast refresh or partial loads
  const d = data || {};
  const stepType = d.stepType || 'unknown';
  const getNodeIcon = (stepType) => {
    const icons = {
      start: '🎬',
      web_scrape: '🌐',
      api_call: '🔗',
      data_transform: '🔄',
      condition: '❓',
      email: '📧',
      file_upload: '📁',
      delay: '⏰',
      end: '🏁'
    };
    return icons[stepType] || '⚙️';
  };

  const getNodeColor = (stepType) => {
    const colors = {
      start: 'success',
      end: 'error',
      web_scrape: 'primary',
      api_call: 'secondary',
      data_transform: 'warning',
      condition: 'secondary',
      email: 'primary',
      file_upload: 'success',
      delay: 'gray',
    };
    return colors[stepType] || 'primary';
  };

  const getStatusIcon = () => {
    if (d.isRunning) return <FaClock className={styles.statusIcon} />;
    if (d.hasError) return <FaExclamationTriangle className={styles.statusIcon} />;
    if (d.isConfigured) return <FaCheckCircle className={styles.statusIcon} />;
    return <FaCog className={styles.statusIcon} />;
  };

  const nodeColorClass = getNodeColor(stepType);
  const isControlNode = stepType === 'start' || stepType === 'end';

  return (
    <div className={`${styles.customNode} ${styles[nodeColorClass]} ${selected ? styles.selected : ''} ${d.isRunning ? styles.running : ''}`}>
      {/* Input Handle */}
      {stepType !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className={styles.handle}
          isConnectable={!d.isReadOnly}
        />
      )}

      {/* Node Content */}
      <div className={styles.nodeContent}>
        <div className={styles.nodeHeader}>
          <span className={styles.nodeIcon}>
            {getNodeIcon(stepType)}
          </span>
          <div className={styles.nodeInfo}>
            <div className={styles.nodeTitle}>{d.label || 'Step'}</div>
            {stepType && (
              <div className={styles.nodeType}>
                {stepType.replace('_', ' ')}
              </div>
            )}
          </div>
          <div className={styles.nodeStatus}>
            {getStatusIcon()}
          </div>
        </div>

        {/* Configuration Status */}
        {!isControlNode && (
          <div className={styles.configStatus}>
            <div className={`${styles.configIndicator} ${d.isConfigured ? styles.configured : styles.unconfigured}`}>
              {d.isConfigured ? 'Configured' : 'Needs Setup'}
            </div>
          </div>
        )}

        {/* Error Message */}
    {d.hasError && d.errorMessage && (
          <div className={styles.errorMessage}>
      {d.errorMessage}
          </div>
        )}

        {/* Execution Progress */}
    {d.isRunning && d.progress !== undefined && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
        style={{ width: `${d.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Output Handle */}
    {stepType !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={styles.handle}
      isConnectable={!d.isReadOnly}
        />
      )}

      {/* Conditional Handles for condition nodes */}
    {stepType === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className={`${styles.handle} ${styles.trueHandle}`}
      isConnectable={!d.isReadOnly}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="false"
            className={`${styles.handle} ${styles.falseHandle}`}
      isConnectable={!d.isReadOnly}
          />
        </>
      )}
    </div>
  );
};

CustomNode.propTypes = {
  data: PropTypes.shape({
    label: PropTypes.string,
    stepType: PropTypes.string,
    actionType: PropTypes.string,
    config: PropTypes.object,
    isConfigured: PropTypes.bool,
    isRunning: PropTypes.bool,
    hasError: PropTypes.bool,
    errorMessage: PropTypes.string,
    progress: PropTypes.number,
    isReadOnly: PropTypes.bool
  }),
  selected: PropTypes.bool
};

export default memo(CustomNode);