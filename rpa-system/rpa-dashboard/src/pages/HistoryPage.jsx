import React, { useEffect, useState } from 'react';
import TaskList from '../components/TaskList/TaskList';
import { getRuns } from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import styles from './HistoryPage.module.css';

// Robust fallback data for when backend is unavailable
const fallbackRuns = [
  {
    id: 1,
    automation_tasks: {
      name: 'Daily Sales Report',
      url: 'https://crm.example.com/reports'
    },
    status: 'completed',
    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    result: { 
      pdf: 'https://example.com/reports/sales-report-2025-01-27.pdf',
      summary: 'Successfully extracted 156 sales records'
    }
  },
  {
    id: 2,
    automation_tasks: {
      name: 'Invoice Processing',
      url: 'https://accounting.example.com/invoices'
    },
    status: 'completed',
    started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    result: { 
      summary: 'Processed 23 invoices, 2 flagged for review'
    }
  },
  {
    id: 3,
    automation_tasks: {
      name: 'Customer Data Sync',
      url: 'https://customers.example.com/sync'
    },
    status: 'failed',
    started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    result: { 
      error: 'Connection timeout to external API'
    }
  },
  {
    id: 4,
    automation_tasks: {
      name: 'Inventory Update',
      url: 'https://inventory.example.com/update'
    },
    status: 'in_progress',
    started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    result: null
  },
  {
    id: 5,
    automation_tasks: {
      name: 'Email Campaign Analytics',
      url: 'https://marketing.example.com/analytics'
    },
    status: 'completed',
    started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    result: { 
      pdf: 'https://example.com/reports/email-analytics-2025-01-26.pdf',
      summary: 'Campaign reached 5,432 recipients, 18.5% open rate'
    }
  }
];

const HistoryPage = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState(fallbackRuns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to fetch real data with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );
        
        const runsPromise = getRuns();
        const fetchedRuns = await Promise.race([runsPromise, timeoutPromise]);
        
        setRuns(fetchedRuns && fetchedRuns.length > 0 ? fetchedRuns : fallbackRuns);
        setIsUsingFallback(false);
        
      } catch (err) {
        console.warn('Backend unavailable for history, using fallback data:', err.message);
        setRuns(fallbackRuns);
        setIsUsingFallback(true);
        setError(null); // Don't show error, just use fallback
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRuns();
    } else {
      // Show fallback data even without user for demo purposes
      setRuns(fallbackRuns);
      setIsUsingFallback(true);
    }
  }, [user]);

  // Map the fetched run data to the structure expected by the TaskList component
  const mappedTasks = runs.map(run => ({
    id: run.id,
    url: run.automation_tasks?.url || 'N/A',
    username: '', // Not available in the runs data
    type: run.automation_tasks?.name || 'Unknown Task',
    status: run.status,
    created_at: run.started_at,
    artifact_url: run.result?.pdf || null,
    result: run.result,
  }));

  const handleViewTask = (task) => {
    if (task.result) {
      const resultText = JSON.stringify(task.result, null, 2);
      alert(`Task Result:\n\n${resultText}`);
    } else {
      alert('No result data available for this task.');
    }
  };

  const handleRefresh = () => {
    if (isUsingFallback) {
      alert('🔄 In demo mode - showing sample automation history. Connect to backend for real data.');
      return;
    }
    
    // Refresh the data
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const fetchedRuns = await getRuns();
        setRuns(fetchedRuns || fallbackRuns);
      } catch (err) {
        console.error('Failed to refresh runs:', err);
        setError('Failed to refresh automation history.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRuns();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          color: 'var(--text-muted)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid var(--color-primary-200)', 
              borderTop: '3px solid var(--color-primary-600)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            <p>Loading automation history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isUsingFallback && (
        <div style={{
          background: 'var(--color-warning-50)',
          border: '1px solid var(--color-warning-200)',
          color: 'var(--color-warning-800)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-md)',
          margin: '0 0 var(--spacing-lg) 0',
          textAlign: 'center',
          fontSize: 'var(--font-size-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>📡 Demo Mode: Showing sample automation history</span>
          <button 
            onClick={handleRefresh}
            style={{
              background: 'var(--color-warning-600)',
              color: 'white',
              border: 'none',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          {error}
          <button 
            onClick={handleRefresh}
            style={{
              marginLeft: 'var(--spacing-md)',
              background: 'var(--color-error-600)',
              color: 'white',
              border: 'none',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {mappedTasks.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-3xl)', 
          color: 'var(--text-muted)',
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-gray-200)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-lg)' }}>📊</div>
          <h3 className="text-heading-3" style={{ marginBottom: 'var(--spacing-md)' }}>No Automation History</h3>
          <p className="text-body">Your automation runs will appear here once you start executing tasks.</p>
        </div>
      ) : (
        <TaskList
          tasks={mappedTasks}
          onEdit={null}
          onDelete={null}
          onView={handleViewTask}
        />
      )}
    </div>
  );
};

export default HistoryPage;