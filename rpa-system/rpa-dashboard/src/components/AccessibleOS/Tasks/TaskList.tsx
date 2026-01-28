import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types';
import { useTasks } from '../../hooks/useTasks';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import styles from './TaskList.module.css';

interface TaskListProps {
 status?: string;
 categoryId?: string;
}

const TaskList: React.FC<TaskListProps> = ({ status, categoryId }) => {
 const {
 tasks,
 categories,
 loading,
 error,
 createTask,
 updateTask,
 deleteTask,
 } = useTasks({
 status,
 categoryId,
 limit: 50,
 });
 const [showForm, setShowForm] = useState(false);
 const [editingTask, setEditingTask] = useState<Task | null>(null);

 const handleCreateTask = async (taskData: Partial<Task>) => {
 try {
 await createTask(taskData);
 setShowForm(false);
 } catch (error) {
 console.error('Failed to create task:', error);
 }
 };

 const navigate = useNavigate();
 const goToCreatePage = () => navigate('/tasks/new');

 const handleUpdateTask = async (taskData: Partial<Task>) => {
 if (!editingTask) return;

 try {
 await updateTask(editingTask.id, taskData);
 setEditingTask(null);
 } catch (error) {
 console.error('Failed to update task:', error);
 }
 };

 const handleDeleteTask = async (taskId: string) => {
 if (!confirm('Are you sure you want to delete this task?')) return;

 try {
 await deleteTask(taskId);
 } catch (error) {
 console.error('Failed to delete task:', error);
 }
 };

 const handleEditTask = (task: Task) => {
 setEditingTask(task);
 setShowForm(true);
 };

 const handleCancelEdit = () => {
 setEditingTask(null);
 setShowForm(false);
 };

 if (loading) {
 return (
 <div className={styles.loading} role="status" aria-live="polite">
 <div className={styles.spinner}></div>
 <span>Loading tasks...</span>
 </div>
 );
 }

 if (error) {
 return (
 <div className={styles.error} role="alert">
 <h3>Error Loading Tasks</h3>
 <p>{error}</p>
 </div>
 );
 }

 return (
 <div className={styles.taskList}>
 <div className={styles.header}>
 <h2 className={styles.title}>
 {status
 ? `${status.charAt(0).toUpperCase() + status.slice(1)} Tasks`
 : 'All Tasks'}
 </h2>
 <button
 className={styles.addButton}
 onClick={goToCreatePage}
 aria-label="Add new task"
 >
 Add Task
 </button>
 </div>

 {showForm && (
 <div className={styles.formContainer}>
 <TaskForm
 task={editingTask}
 categories={categories}
 onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
 onCancel={handleCancelEdit}
 />
 </div>
 )}

 {tasks.length === 0 ? (
 <div className={styles.emptyState}>
 <h3>No tasks found</h3>
 <p>Create your first task to get started!</p>
 <button
 className={styles.primaryButton}
 onClick={() => setShowForm(true)}
 >
 Create Task
 </button>
 </div>
 ) : (
 <div className={styles.tasks} role="list">
 {tasks.map(task => (
 <TaskItem
 key={task.id}
 task={task}
 onEdit={handleEditTask}
 onDelete={handleDeleteTask}
 onStatusChange={status => updateTask(task.id, { status })}
 />
 ))}
 </div>
 )}
 </div>
 );
};

export default TaskList;
