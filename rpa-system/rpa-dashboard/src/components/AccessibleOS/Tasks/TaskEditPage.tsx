import React from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('TaskEditPage');
import { useParams, useNavigate } from 'react-router-dom';
import TaskForm from './TaskForm';
import { useTasks } from '../../hooks/useTasks';

const TaskEditPage: React.FC = () => {
 const { id } = useParams();
 const navigate = useNavigate();
 const { tasks, updateTask, categories } = useTasks();

 const task = tasks.find(t => t.id === id) || null;

 const handleUpdate = async (data: any) => {
 if (!id) return;
 try {
 await updateTask(id, data);
 navigate(`/tasks/${id}`);
 } catch (e) {
 logger.error('Failed to update task', e);
 }
 };

 return (
 <div style={{ padding: '2rem' }}>
 <h1>Edit Task</h1>
 <TaskForm
 task={task}
 categories={categories}
 onSubmit={handleUpdate}
 onCancel={() => navigate(`/tasks/${id}`)}
 />
 </div>
 );
};

export default TaskEditPage;
