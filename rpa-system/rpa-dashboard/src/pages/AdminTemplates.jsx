
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminTemplates.module.css';
import PlanGate from '../components/PlanGate/PlanGate';

const AdminTemplates = () => {
 const navigate = useNavigate();
 const [items, setItems] = useState([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const [status, setStatus] = useState('pending_review');

 const ADMIN_BASE = process.env.REACT_APP_API_BASE || '';
 const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

 const fetchTemplates = useCallback(async () => {
 try {
 setLoading(true);
 setError(null);
 const { api } = require('../utils/api');
 const { data } = await api.get(`${ADMIN_BASE}/admin/templates?status=${encodeURIComponent(status)}`, { headers: { 'x-admin-secret': ADMIN_SECRET } });
 setItems((data && data.templates) || []);
 } catch (e) {
 setError(e.message);
 } finally {
 setLoading(false);
 }
 }, [ADMIN_BASE, ADMIN_SECRET, status]);

 const act = async (id, action) => {
 const url = `${ADMIN_BASE}/admin/templates/${id}/${action}`;
 const { api } = require('../utils/api');
 await api.post(url, {}, { headers: { 'x-admin-secret': ADMIN_SECRET } });
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
 }, [fetchTemplates]);

 return (
 <PlanGate 
 feature="admin_templates" 
 upgradeMessage="Admin template moderation is restricted to authorized users."
 onPaywallClose={() => {
 console.log('[AdminTemplates] Paywall dismissed, navigating back');
 navigate(-1);
 }}
 >
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

 {loading && <div className={styles.status}>Loading...</div>}
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
 </PlanGate>
 );
};

export default AdminTemplates;
