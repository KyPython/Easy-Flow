import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './TemplateDetails.module.css';
import { useWorkflowTemplates } from '../../hooks/useWorkflowTemplates';
import LoadingSpinner from './LoadingSpinner';

const TemplateDetails = ({ templateId, onBack, onUse }) => {
  const { getTemplateDetails, createFromTemplate } = useWorkflowTemplates({ autoLoad: false });
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getTemplateDetails(templateId);
        setTemplate(data);
      } catch (e) {
        setError(e.message || 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [templateId, getTemplateDetails]);

  const handleUse = async () => {
    if (!template) return;
    const name = `${template.name} - ${new Date().toLocaleDateString()}`;
    const wf = await createFromTemplate(template.id, name);
    onUse?.(wf);
  };

  if (loading) return <div className={styles.wrapper}><LoadingSpinner centered message="Loading template..." /></div>;
  if (error) return <div className={styles.wrapper}><p className={styles.error}>Error: {error}</p></div>;
  if (!template) return null;

  const latest = template.versions?.[0];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>← Back</button>
        <h2 className={styles.title}>{template.name}</h2>
        <div className={styles.actions}>
          <button className={styles.useBtn} onClick={handleUse}>Use Template</button>
        </div>
      </div>

      {/* Preview images */}
      {Array.isArray(template.preview_images) && template.preview_images.length > 0 && (
        <div className={styles.previews}>
          {template.preview_images.map((src, i) => (
            <img key={i} src={src} alt={`Preview ${i+1}`} className={styles.previewImg} />
          ))}
        </div>
      )}

      <div className={styles.meta}>
        <div className={styles.section}>
          <h3>Description</h3>
          <p>{template.description || 'No description provided.'}</p>
        </div>
        <div className={styles.section}>
          <h3>Tags</h3>
          <div className={styles.tags}>
            {(template.tags || []).map((t) => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.col}>
          <h3>Changelog</h3>
          {template.versions?.length ? (
            <ul className={styles.list}>
              {template.versions.map(v => (
                <li key={v.id}>
                  <div className={styles.versionHeader}>
                    <span className={styles.version}>v{v.version}</span>
                    <span className={styles.date}>{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  <pre className={styles.changelog}>{v.changelog || '—'}</pre>
                </li>
              ))}
            </ul>
          ) : <p>No versions yet.</p>}
        </div>
        <div className={styles.col}>
          <h3>Dependencies</h3>
          {latest?.dependencies?.length ? (
            <ul className={styles.list}>
              {latest.dependencies.map((d, idx) => (
                <li key={idx}>
                  <code>{d.name}</code> {d.version ? `@ ${d.version}` : ''}
                </li>
              ))}
            </ul>
          ) : <p>None listed.</p>}

          <h3 className={styles.subhead}>Screenshots</h3>
          {latest?.screenshots?.length ? (
            <div className={styles.screenshots}>
              {latest.screenshots.map((src, i) => (
                <img key={i} src={src} alt={`Screenshot ${i+1}`} className={styles.screenshot} />
              ))}
            </div>
          ) : <p>No screenshots.</p>}
        </div>
      </div>
    </div>
  );
};

TemplateDetails.propTypes = {
  templateId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onBack: PropTypes.func,
  onUse: PropTypes.func
};

export default TemplateDetails;
