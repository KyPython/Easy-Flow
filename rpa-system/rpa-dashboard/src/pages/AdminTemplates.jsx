import React, { useEffect, useState } from 'react';
import styles from './AdminTemplates.module.css';

const AdminTemplates = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending_review');

  const ADMIN_BASE = process.env.REACT_APP_API_BASE || '';
  const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${ADMIN_BASE}/admin/templates?status=${encodeURIComponent(status)}`;
      const resp = await fetch(url, { headers: { 'x-admin-secret': ADMIN_SECRET } });
      if (!resp.ok) throw new Error(`Failed to load: ${resp.status}`);
      const json = await resp.json();
      setItems(json.templates || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const act = async (id, action) => {
    const url = `${ADMIN_BASE}/admin/templates/${id}/${action}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({}),
    });
    if (!resp.ok) throw new Error(`Action failed: ${resp.status}`);
  };

  const approve = async (id) => {
    try {
      await act(id, 'approve');
      await fetchTemplates();
    } catch (e) {
      alert(e.message);
    }
  };

  const reject = async (id) => {
    try {
      await act(id, 'reject');
      await fetchTemplates();
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2>Template Moderation</h2>
        <div className={styles.controls}>
          <label htmlFor="admin-status-filter" style={{display:'none'}}>Status</label>
          <select id="admin-status-filter" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button onClick={fetchTemplates}>Refresh</button>
        </div>
      </div>

      {loading && <div className={styles.status}>Loading…</div>}
      {error && <div className={styles.error}>Error: {error}</div>}

      <div className={styles.list}>
        {items.map(t => (
          <div key={t.id} className={styles.item}>
            <div className={styles.meta}>
              <div className={styles.name}>{t.name}</div>
              <div className={styles.desc}>{t.description}</div>
              <div className={styles.tags}>
                <span className={styles.badge}>{t.category || 'general'}</span>
                <span className={styles.badge}>{t.status}</span>
                {Array.isArray(t.tags) && t.tags.slice(0, 3).map(tag => (
                  <span key={tag} className={styles.tag}>#{tag}</span>
                ))}
              </div>
            </div>
            <div className={styles.actions}>
              {t.status !== 'approved' && (
                <button className={styles.approve} onClick={() => approve(t.id)}>Approve</button>
              )}
              {t.status !== 'rejected' && (
                <button className={styles.reject} onClick={() => reject(t.id)}>Reject</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminTemplates;
