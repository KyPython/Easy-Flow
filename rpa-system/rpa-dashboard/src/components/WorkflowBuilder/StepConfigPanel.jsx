import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './StepConfigPanel.module.css';
import { FaTimes, FaTrash, FaPlus, FaMinus, FaCog, FaCheck } from 'react-icons/fa';

const StepConfigPanel = ({ node, onClose, onSave, onDelete, isReadOnly = false }) => {
  const [config, setConfig] = useState(node.data.config || {});
  const [isValid, setIsValid] = useState(false);
  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => {
    setConfig(node.data.config || {});
    validateConfig(node.data.config || {});
  }, [node]);

  const validateConfig = (configData) => {
    const { stepType } = node.data;
    let valid = false;

    switch (stepType) {
      case 'web_scrape':
        valid = !!(configData.url && configData.url.trim());
        break;
      case 'api_call':
        valid = !!(configData.url && configData.url.trim() && configData.method);
        break;
      case 'email':
        valid = !!(configData.to && configData.to.length > 0 && configData.subject && configData.subject.trim());
        break;
      case 'condition':
        valid = !!(configData.conditions && configData.conditions.length > 0);
        break;
      case 'data_transform':
        valid = !!(configData.transformations && configData.transformations.length > 0);
        break;
      case 'file_upload':
        valid = !!(configData.destination && configData.destination.trim());
        break;
      case 'delay':
        valid = !!(configData.duration_seconds && configData.duration_seconds > 0);
        break;
      default:
        valid = true;
    }

    setIsValid(valid);
  };

  const updateConfig = (updates) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    validateConfig(newConfig);
  };

  const handleSave = () => {
    if (isValid) {
      onSave(config);
      onClose();
    }
  };

  const renderConfigForm = () => {
    const { stepType } = node.data;

    switch (stepType) {
      case 'web_scrape':
        return <WebScrapeConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'api_call':
        return <ApiCallConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'email':
        return <EmailConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'condition':
        return <ConditionConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'data_transform':
        return <DataTransformConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'file_upload':
        return <FileUploadConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'delay':
        return <DelayConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />;
      case 'start':
      case 'end':
        return <BasicConfig config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} stepType={stepType} />;
      default:
        return <div className={styles.noConfig}>No configuration required</div>;
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <span className={styles.nodeIcon}>{getStepIcon(node.data.stepType)}</span>
            <div>
              <h3 className={styles.title}>{node.data.label}</h3>
              <p className={styles.subtitle}>Configure step behavior</p>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'config' ? styles.active : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <FaCog /> Configuration
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'config' ? (
            <div className={styles.configForm}>
              {renderConfigForm()}
            </div>
          ) : (
            <div className={styles.settingsForm}>
              <StepSettings node={node} config={config} updateConfig={updateConfig} isReadOnly={isReadOnly} />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {!isReadOnly && (
              <button className={styles.deleteButton} onClick={() => onDelete(node.id)}>
                <FaTrash /> Delete Step
              </button>
            )}
          </div>
          <div className={styles.footerRight}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            {!isReadOnly && (
              <button 
                className={`${styles.saveButton} ${isValid ? styles.valid : styles.invalid}`}
                onClick={handleSave}
                disabled={!isValid}
              >
                <FaCheck /> Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Web Scraping Configuration
const WebScrapeConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Target URL *
      <input
        type="url"
        className={styles.input}
        value={config.url || ''}
        onChange={(e) => updateConfig({ url: e.target.value })}
        placeholder="https://example.com"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      CSS Selectors
      <SelectorList
        selectors={config.selectors || []}
        onChange={(selectors) => updateConfig({ selectors })}
        isReadOnly={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Wait for Element
      <input
        type="text"
        className={styles.input}
        value={config.wait_for || ''}
        onChange={(e) => updateConfig({ wait_for: e.target.value })}
        placeholder="CSS selector to wait for"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Timeout (seconds)
      <input
        type="number"
        className={styles.input}
        value={config.timeout || 30}
        onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) })}
        min="5"
        max="300"
        disabled={isReadOnly}
      />
    </label>
  </div>
);

// API Call Configuration
const ApiCallConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      HTTP Method *
      <select
        className={styles.select}
        value={config.method || 'GET'}
        onChange={(e) => updateConfig({ method: e.target.value })}
        disabled={isReadOnly}
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
      </select>
    </label>

    <label className={styles.label}>
      API URL *
      <input
        type="url"
        className={styles.input}
        value={config.url || ''}
        onChange={(e) => updateConfig({ url: e.target.value })}
        placeholder="https://api.example.com/endpoint"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Headers
      <KeyValueList
        items={config.headers || {}}
        onChange={(headers) => updateConfig({ headers })}
        keyPlaceholder="Header name"
        valuePlaceholder="Header value"
        isReadOnly={isReadOnly}
      />
    </label>

    {(config.method === 'POST' || config.method === 'PUT') && (
      <label className={styles.label}>
        Request Body (JSON)
        <textarea
          className={styles.textarea}
          value={config.body ? JSON.stringify(config.body, null, 2) : ''}
          onChange={(e) => {
            try {
              const body = JSON.parse(e.target.value);
              updateConfig({ body });
            } catch (error) {
              // Invalid JSON, keep as string for now
            }
          }}
          placeholder='{"key": "value"}'
          rows="4"
          disabled={isReadOnly}
        />
      </label>
    )}

    <label className={styles.label}>
      Timeout (seconds)
      <input
        type="number"
        className={styles.input}
        value={config.timeout || 30}
        onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) })}
        min="5"
        max="300"
        disabled={isReadOnly}
      />
    </label>
  </div>
);

// Email Configuration
const EmailConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Recipients *
      <EmailList
        emails={config.to || []}
        onChange={(to) => updateConfig({ to })}
        isReadOnly={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Subject *
      <input
        type="text"
        className={styles.input}
        value={config.subject || ''}
        onChange={(e) => updateConfig({ subject: e.target.value })}
        placeholder="Email subject"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Template
      <select
        className={styles.select}
        value={config.template || ''}
        onChange={(e) => updateConfig({ template: e.target.value })}
        disabled={isReadOnly}
      >
        <option value="">Select template</option>
        <option value="success">Success Notification</option>
        <option value="error">Error Alert</option>
        <option value="report">Report Summary</option>
        <option value="custom">Custom Template</option>
      </select>
    </label>

    <label className={styles.label}>
      Variables
      <KeyValueList
        items={config.variables || {}}
        onChange={(variables) => updateConfig({ variables })}
        keyPlaceholder="Variable name"
        valuePlaceholder="Default value"
        isReadOnly={isReadOnly}
      />
    </label>
  </div>
);

// Condition Configuration
const ConditionConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Operator
      <select
        className={styles.select}
        value={config.operator || 'AND'}
        onChange={(e) => updateConfig({ operator: e.target.value })}
        disabled={isReadOnly}
      >
        <option value="AND">AND (all conditions must be true)</option>
        <option value="OR">OR (any condition can be true)</option>
      </select>
    </label>

    <label className={styles.label}>
      Conditions *
      <ConditionList
        conditions={config.conditions || []}
        onChange={(conditions) => updateConfig({ conditions })}
        isReadOnly={isReadOnly}
      />
    </label>
  </div>
);

// Data Transform Configuration
const DataTransformConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Output Format
      <select
        className={styles.select}
        value={config.output_format || 'json'}
        onChange={(e) => updateConfig({ output_format: e.target.value })}
        disabled={isReadOnly}
      >
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="xml">XML</option>
      </select>
    </label>

    <label className={styles.label}>
      Transformations *
      <TransformationList
        transformations={config.transformations || []}
        onChange={(transformations) => updateConfig({ transformations })}
        isReadOnly={isReadOnly}
      />
    </label>
  </div>
);

// File Upload Configuration
const FileUploadConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Source Field
      <input
        type="text"
        className={styles.input}
        value={config.source_field || ''}
        onChange={(e) => updateConfig({ source_field: e.target.value })}
        placeholder="e.g. scraped_data.file, api_response.url, downloaded_files[0]"
        disabled={isReadOnly}
      />
    </label>

    <div className={styles.helpText}>
      Optional: Provide a field from previous step output that resolves to a Buffer, data URL/base64, URL, or array of these. If empty, you can specify a direct URL below.
    </div>

    <label className={styles.label}>
      Direct URL
      <input
        type="text"
        className={styles.input}
        value={config.url || ''}
        onChange={(e) => updateConfig({ url: e.target.value })}
        placeholder="https://example.com/path/to/file.pdf"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Destination Path *
      <input
        type="text"
        className={styles.input}
        value={config.destination || ''}
        onChange={(e) => updateConfig({ destination: e.target.value })}
        placeholder="uploads/documents/"
        disabled={isReadOnly}
      />
    </label>

    <div className={styles.gridRow}>
      <label className={styles.label}>
        Suggested Filename
        <input
          type="text"
          className={styles.input}
          value={config.filename || ''}
          onChange={(e) => updateConfig({ filename: e.target.value })}
          placeholder="Optional: report.pdf"
          disabled={isReadOnly}
        />
      </label>

      <label className={styles.label}>
        MIME Type
        <input
          type="text"
          className={styles.input}
          value={config.mime_type || ''}
          onChange={(e) => updateConfig({ mime_type: e.target.value })}
          placeholder="Optional: application/pdf"
          disabled={isReadOnly}
        />
      </label>
    </div>

    <label className={styles.label}>
      Tags (comma-separated)
      <input
        type="text"
        className={styles.input}
        value={Array.isArray(config.tags) ? config.tags.join(', ') : (config.tags || '')}
        onChange={(e) => updateConfig({ tags: e.target.value })}
        placeholder="e.g. receipts, 2025, finance"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={config.overwrite || false}
        onChange={(e) => updateConfig({ overwrite: e.target.checked })}
        disabled={isReadOnly}
      />
      Overwrite existing files
    </label>

    <label className={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={config.public || false}
        onChange={(e) => updateConfig({ public: e.target.checked })}
        disabled={isReadOnly}
      />
      Make files publicly accessible
    </label>
  </div>
);

// Delay Configuration
const DelayConfig = ({ config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Duration (seconds) *
      <input
        type="number"
        className={styles.input}
        value={config.duration_seconds || 5}
        onChange={(e) => updateConfig({ duration_seconds: parseInt(e.target.value) })}
        min="1"
        max="3600"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.label}>
      Duration Type
      <select
        className={styles.select}
        value={config.duration_type || 'fixed'}
        onChange={(e) => updateConfig({ duration_type: e.target.value })}
        disabled={isReadOnly}
      >
        <option value="fixed">Fixed delay</option>
        <option value="random">Random delay (0 to specified seconds)</option>
      </select>
    </label>
  </div>
);

// Basic Configuration for Start/End nodes
const BasicConfig = ({ config, updateConfig, isReadOnly, stepType }) => (
  <div className={styles.formGroup}>
    {stepType === 'end' && (
      <>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.success !== false}
            onChange={(e) => updateConfig({ success: e.target.checked })}
            disabled={isReadOnly}
          />
          Mark as successful completion
        </label>

        <label className={styles.label}>
          Completion Message
          <input
            type="text"
            className={styles.input}
            value={config.message || ''}
            onChange={(e) => updateConfig({ message: e.target.value })}
            placeholder="Workflow completed successfully"
            disabled={isReadOnly}
          />
        </label>
      </>
    )}
    {stepType === 'start' && (
      <div className={styles.infoMessage}>
        This is the starting point of your workflow. No configuration is required.
      </div>
    )}
  </div>
);

// Step Settings (common to all steps)
const StepSettings = ({ node, config, updateConfig, isReadOnly }) => (
  <div className={styles.formGroup}>
    <label className={styles.label}>
      Step Name
      <input
        type="text"
        className={styles.input}
        value={node.data.label}
        placeholder="Enter step name"
        disabled={true} // For now, keep step names fixed
      />
    </label>

    <label className={styles.label}>
      Description
      <textarea
        className={styles.textarea}
        value={config.description || ''}
        onChange={(e) => updateConfig({ description: e.target.value })}
        placeholder="Describe what this step does..."
        rows="3"
        disabled={isReadOnly}
      />
    </label>

    <label className={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={config.enabled !== false}
        onChange={(e) => updateConfig({ enabled: e.target.checked })}
        disabled={isReadOnly}
      />
      Enable this step
    </label>

    {node.data.stepType !== 'start' && node.data.stepType !== 'end' && (
      <>
        <label className={styles.label}>
          On Success
          <select
            className={styles.select}
            value={config.on_success || 'continue'}
            onChange={(e) => updateConfig({ on_success: e.target.value })}
            disabled={isReadOnly}
          >
            <option value="continue">Continue to next step</option>
            <option value="end_workflow">End workflow</option>
          </select>
        </label>

        <label className={styles.label}>
          On Error
          <select
            className={styles.select}
            value={config.on_error || 'retry'}
            onChange={(e) => updateConfig({ on_error: e.target.value })}
            disabled={isReadOnly}
          >
            <option value="retry">Retry step</option>
            <option value="continue">Continue anyway</option>
            <option value="fail_workflow">Fail workflow</option>
          </select>
        </label>
      </>
    )}
  </div>
);

// Helper Components
const SelectorList = ({ selectors, onChange, isReadOnly }) => {
  const addSelector = () => {
    onChange([...selectors, { name: '', selector: '' }]);
  };

  const updateSelector = (index, updates) => {
    const updated = selectors.map((sel, i) => 
      i === index ? { ...sel, ...updates } : sel
    );
    onChange(updated);
  };

  const removeSelector = (index) => {
    onChange(selectors.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.listContainer}>
      {selectors.map((selector, index) => (
        <div key={index} className={styles.listItem}>
          <input
            type="text"
            placeholder="Field name"
            value={selector.name || ''}
            onChange={(e) => updateSelector(index, { name: e.target.value })}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          <input
            type="text"
            placeholder="CSS selector"
            value={selector.selector || ''}
            onChange={(e) => updateSelector(index, { selector: e.target.value })}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => removeSelector(index)}
              className={styles.removeButton}
            >
              <FaMinus />
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button type="button" onClick={addSelector} className={styles.addButton}>
          <FaPlus /> Add Selector
        </button>
      )}
    </div>
  );
};

const KeyValueList = ({ items, onChange, keyPlaceholder, valuePlaceholder, isReadOnly }) => {
  const itemsArray = Object.entries(items);

  const addItem = () => {
    onChange({ ...items, '': '' });
  };

  const updateItem = (oldKey, newKey, value) => {
    const updated = { ...items };
    if (oldKey !== newKey) {
      delete updated[oldKey];
    }
    updated[newKey] = value;
    onChange(updated);
  };

  const removeItem = (key) => {
    const updated = { ...items };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className={styles.listContainer}>
      {itemsArray.map(([key, value], index) => (
        <div key={index} className={styles.listItem}>
          <input
            type="text"
            placeholder={keyPlaceholder}
            value={key}
            onChange={(e) => updateItem(key, e.target.value, value)}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          <input
            type="text"
            placeholder={valuePlaceholder}
            value={value}
            onChange={(e) => updateItem(key, key, e.target.value)}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => removeItem(key)}
              className={styles.removeButton}
            >
              <FaMinus />
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button type="button" onClick={addItem} className={styles.addButton}>
          <FaPlus /> Add Item
        </button>
      )}
    </div>
  );
};

const EmailList = ({ emails, onChange, isReadOnly }) => {
  const addEmail = () => {
    onChange([...emails, '']);
  };

  const updateEmail = (index, email) => {
    const updated = emails.map((e, i) => i === index ? email : e);
    onChange(updated);
  };

  const removeEmail = (index) => {
    onChange(emails.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.listContainer}>
      {emails.map((email, index) => (
        <div key={index} className={styles.listItem}>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => updateEmail(index, e.target.value)}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => removeEmail(index)}
              className={styles.removeButton}
            >
              <FaMinus />
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button type="button" onClick={addEmail} className={styles.addButton}>
          <FaPlus /> Add Email
        </button>
      )}
    </div>
  );
};

const ConditionList = ({ conditions, onChange, isReadOnly }) => {
  const addCondition = () => {
    onChange([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const updateCondition = (index, updates) => {
    const updated = conditions.map((cond, i) => 
      i === index ? { ...cond, ...updates } : cond
    );
    onChange(updated);
  };

  const removeCondition = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.listContainer}>
      {conditions.map((condition, index) => (
        <div key={index} className={styles.conditionItem}>
          <input
            type="text"
            placeholder="Field path (e.g., data.status)"
            value={condition.field || ''}
            onChange={(e) => updateCondition(index, { field: e.target.value })}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          <select
            value={condition.operator || 'equals'}
            onChange={(e) => updateCondition(index, { operator: e.target.value })}
            className={styles.listSelect}
            disabled={isReadOnly}
          >
            <option value="equals">equals</option>
            <option value="not_equals">not equals</option>
            <option value="greater_than">greater than</option>
            <option value="less_than">less than</option>
            <option value="contains">contains</option>
            <option value="exists">exists</option>
          </select>
          <input
            type="text"
            placeholder="Value"
            value={condition.value || ''}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => removeCondition(index)}
              className={styles.removeButton}
            >
              <FaMinus />
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button type="button" onClick={addCondition} className={styles.addButton}>
          <FaPlus /> Add Condition
        </button>
      )}
    </div>
  );
};

const TransformationList = ({ transformations, onChange, isReadOnly }) => {
  const addTransformation = () => {
    onChange([...transformations, { type: 'map', source_field: '', target_field: '' }]);
  };

  const updateTransformation = (index, updates) => {
    const updated = transformations.map((trans, i) => 
      i === index ? { ...trans, ...updates } : trans
    );
    onChange(updated);
  };

  const removeTransformation = (index) => {
    onChange(transformations.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.listContainer}>
      {transformations.map((transformation, index) => (
        <div key={index} className={styles.transformationItem}>
          <select
            value={transformation.type || 'map'}
            onChange={(e) => updateTransformation(index, { type: e.target.value })}
            className={styles.listSelect}
            disabled={isReadOnly}
          >
            <option value="map">Map field</option>
            <option value="filter">Filter array</option>
            <option value="aggregate">Aggregate data</option>
          </select>
          <input
            type="text"
            placeholder="Source field"
            value={transformation.source_field || ''}
            onChange={(e) => updateTransformation(index, { source_field: e.target.value })}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          <input
            type="text"
            placeholder="Target field"
            value={transformation.target_field || ''}
            onChange={(e) => updateTransformation(index, { target_field: e.target.value })}
            className={styles.listInput}
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => removeTransformation(index)}
              className={styles.removeButton}
            >
              <FaMinus />
            </button>
          )}
        </div>
      ))}
      {!isReadOnly && (
        <button type="button" onClick={addTransformation} className={styles.addButton}>
          <FaPlus /> Add Transformation
        </button>
      )}
    </div>
  );
};

// Helper function to get step icon
function getStepIcon(stepType) {
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
}

// PropTypes for main component
StepConfigPanel.propTypes = {
  node: PropTypes.shape({
    id: PropTypes.string.isRequired,
    data: PropTypes.shape({
      label: PropTypes.string.isRequired,
      stepType: PropTypes.string.isRequired,
      config: PropTypes.object
    }).isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

// PropTypes for config components
WebScrapeConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

ApiCallConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

EmailConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

ConditionConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

DataTransformConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

FileUploadConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

DelayConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

BasicConfig.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool,
  stepType: PropTypes.string.isRequired
};

StepSettings.propTypes = {
  node: PropTypes.object.isRequired,
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

// PropTypes for helper components
SelectorList.propTypes = {
  selectors: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

KeyValueList.propTypes = {
  items: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  keyPlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string,
  isReadOnly: PropTypes.bool
};

EmailList.propTypes = {
  emails: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

ConditionList.propTypes = {
  conditions: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

TransformationList.propTypes = {
  transformations: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

export default StepConfigPanel;