import React from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('TaskCreatePage');
import { useNavigate } from 'react-router-dom';
import TaskForm from './TaskForm';
import { useTasks } from '../../hooks/useTasks';

const TaskCreatePage: React.FC = () => {
 const navigate = useNavigate();
 const { createTask, categories } = useTasks();

 const handleCreate = async (data: any) => {
 try {
 const newTask = await createTask(data);
 navigate(`/tasks/${newTask.id}`);
 } catch (e) {
 logger.error('Failed to create task', e);
 }
 };

 return (
 <div style={{ padding: '2rem' }}>
 <h1>Create Task</h1>
 <TaskForm
 task={null}
 categories={categories}
 onSubmit={handleCreate}
 onCancel={() => navigate('/tasks')}
 />
 </div>
 );
};

export default TaskCreatePage;
