import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';

const TaskDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();

  if (loading) return <div>Loading...</div>;

  const task = tasks.find(t => t.id === id);

  if (!task) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Task not found</h2>
        <button onClick={() => navigate('/tasks')}>Back to tasks</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{task.title}</h1>
      {task.description && <p>{task.description}</p>}
      <p>Status: {task.status}</p>
      <p>Priority: {task.priority}</p>
      {task.dueDate && <p>Due: {new Date(task.dueDate).toLocaleString()}</p>}
      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => navigate(`/tasks/${task.id}/edit`)}>Edit</button>
        <button onClick={() => navigate('/tasks')}>Back</button>
      </div>
    </div>
  );
};

export default TaskDetail;
