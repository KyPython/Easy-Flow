import { useState } from 'react';
import TaskForm from '../components/TaskForm/TaskForm';
import styles from './TasksPage.module.css';

const TasksPage = () => {
  const [result, setResult] = useState('');
  const [loading] = useState(false);

  const handleTaskSubmit = (response) => {
    setResult(response.result);
  };

  return (
    <div className={styles.container}>
      <TaskForm onTaskSubmit={handleTaskSubmit} loading={loading} />
      
      {result && (
        <div className={styles.resultContainer}>
          <h3 className={styles.resultTitle}>Execution Result</h3>
          <pre className={styles.resultContent}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TasksPage;