import React, { useState } from 'react';
import { Plus, Filter, Search } from '../Icons/Icons';
import Button from '../UI/Button';
import Modal from '../UI/Modal';
import TaskForm from '../Tasks/TaskForm';
import { useTasks } from '../../hooks/useTasks';
import styles from './QuickActions.module.css';

const QuickActions: React.FC = () => {
 const [showTaskForm, setShowTaskForm] = useState(false);
 const { categories, createTask } = useTasks();

 const handleCreateTask = async (taskData: any) => {
 try {
 await createTask(taskData);
 setShowTaskForm(false);
 } catch (error) {
 console.error('Failed to create task:', error);
 }
 };

 return (
 <div className={styles.quickActions}>
 <Button
 variant="primary"
 onClick={() => setShowTaskForm(true)}
 aria-label="Create new task"
 >
 <Plus size={16} />
 New Task
 </Button>

 <Button variant="ghost" aria-label="Search tasks">
 <Search size={16} />
 </Button>

 <Button variant="ghost" aria-label="Filter tasks">
 <Filter size={16} />
 </Button>

 <Modal
 isOpen={showTaskForm}
 onClose={() => setShowTaskForm(false)}
 title="Create New Task"
 size="lg"
 >
 <TaskForm
 categories={categories}
 onSubmit={handleCreateTask}
 onCancel={() => setShowTaskForm(false)}
 />
 </Modal>
 </div>
 );
};

export default QuickActions;
