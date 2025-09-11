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
    if (data.isRunning) return <FaClock className={styles.statusIcon} />;
    if (data.hasError) return <FaExclamationTriangle className={styles.statusIcon} />;
    if (data.isConfigured) return <FaCheckCircle className={styles.statusIcon} />;
    return <FaCog className={styles.statusIcon} />;
  };

  const nodeColorClass = getNodeColor(data.stepType);
  const isControlNode = data.stepType === 'start' || data.stepType === 'end';

  return (
    <div className={`${styles.customNode} ${styles[nodeColorClass]} ${selected ? styles.selected : ''} ${data.isRunning ? styles.running : ''}`}>
      {/* Input Handle */}
      {data.stepType !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className={styles.handle}
          isConnectable={!data.isReadOnly}
        />
      )}

      {/* Node Content */}
      <div className={styles.nodeContent}>
        <div className={styles.nodeHeader}>
          <span className={styles.nodeIcon}>
            {getNodeIcon(data.stepType)}
          </span>
          <div className={styles.nodeInfo}>
            <div className={styles.nodeTitle}>{data.label}</div>
            {data.stepType && (
              <div className={styles.nodeType}>
                {data.stepType.replace('_', ' ')}
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
            <div className={`${styles.configIndicator} ${data.isConfigured ? styles.configured : styles.unconfigured}`}>
              {data.isConfigured ? 'Configured' : 'Needs Setup'}
            </div>
          </div>
        )}

        {/* Error Message */}
        {data.hasError && data.errorMessage && (
          <div className={styles.errorMessage}>
            {data.errorMessage}
          </div>
        )}

        {/* Execution Progress */}
        {data.isRunning && data.progress !== undefined && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${data.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Output Handle */}
      {data.stepType !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={styles.handle}
          isConnectable={!data.isReadOnly}
        />
      )}

      {/* Conditional Handles for condition nodes */}
      {data.stepType === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className={`${styles.handle} ${styles.trueHandle}`}
            isConnectable={!data.isReadOnly}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="false"
            className={`${styles.handle} ${styles.falseHandle}`}
            isConnectable={!data.isReadOnly}
          />
        </>
      )}
    </div>
  );
};

CustomNode.propTypes = {
  data: PropTypes.shape({
    label: PropTypes.string.isRequired,
    stepType: PropTypes.string.isRequired,
    actionType: PropTypes.string,
    config: PropTypes.object,
    isConfigured: PropTypes.bool,
    isRunning: PropTypes.bool,
    hasError: PropTypes.bool,
    errorMessage: PropTypes.string,
    progress: PropTypes.number,
    isReadOnly: PropTypes.bool
  }).isRequired,
  selected: PropTypes.bool
};

export default memo(CustomNode);