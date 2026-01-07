import React, { useState, useEffect } from 'react';
import { Task, TaskCategory } from '../../types';
import styles from './TaskForm.module.css';

interface TaskFormProps {
 task?: Task | null;
 categories: TaskCategory[];
 onSubmit: (taskData: Partial<Task>) => void;
 onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, categories, onSubmit, onCancel }) => {
 const [formData, setFormData] = useState({
 title: '',
 description: '',
 priority: 'medium' as Task['priority'],
 dueDate: '',
 estimatedDuration: '',
 tags: '',
 categoryIds: [] as string[],
 });

 useEffect(() => {
 if (task) {
 setFormData({
 title: task.title,
 description: task.description || '',
 priority: task.priority,
 dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
 estimatedDuration: task.estimatedDuration?.toString() || '',
 tags: task.tags.join(', '),
 categoryIds: task.categories.map(c => c.id),
 });
 }
 }, [task]);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 
 const taskData: Partial<Task> = {
 title: formData.title.trim(),
 description: formData.description.trim() || undefined,
 priority: formData.priority,
 dueDate: formData.dueDate || undefined,
 estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : undefined,
 tags: formData.tags
 .split(',')
 .map(tag => tag.trim())
 .filter(tag => tag.length > 0),
 categories: categories.filter(c => formData.categoryIds.includes(c.id)),
 };

 onSubmit(taskData);
 };

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handleCategoryChange = (categoryId: string, checked: boolean) => {
 setFormData(prev => ({
 ...prev,
 categoryIds: checked
 ? [...prev.categoryIds, categoryId]
 : prev.categoryIds.filter(id => id !== categoryId)
 }));
 };

 return (
 <form onSubmit={handleSubmit} className={styles.taskForm}>
 <div className={styles.formHeader}>
 <h3>{task ? 'Edit Task' : 'Create New Task'}</h3>
 <button
 type="button"
 onClick={onCancel}
 className={styles.closeButton}
 aria-label="Close form"
 >
 ×
 </button>
 </div>

 <div className={styles.formBody}>
 <div className={styles.formGroup}>
 <label htmlFor="title" className={styles.label}>
 Title *
 </label>
 <input
 type="text"
 id="title"
 name="title"
 value={formData.title}
 onChange={handleChange}
 className={styles.input}
 required
 maxLength={500}
 />
 </div>

 <div className={styles.formGroup}>
 <label htmlFor="description" className={styles.label}>
 Description
 </label>
 <textarea
 id="description"
 name="description"
 value={formData.description}
 onChange={handleChange}
 className={styles.textarea}
 rows={3}
 maxLength={2000}
 />
 </div>

 <div className={styles.formRow}>
 <div className={styles.formGroup}>
 <label htmlFor="priority" className={styles.label}>
 Priority
 </label>
 <select
 id="priority"
 name="priority"
 value={formData.priority}
 onChange={handleChange}
 className={styles.select}
 >
 <option value="low">Low</option>
 <option value="medium">Medium</option>
 <option value="high">High</option>
 <option value="urgent">Urgent</option>
 </select>
 </div>

 <div className={styles.formGroup}>
 <label htmlFor="dueDate" className={styles.label}>
 Due Date
 </label>
 <input
 type="date"
 id="dueDate"
 name="dueDate"
 value={formData.dueDate}
 onChange={handleChange}
 className={styles.input}
 />
 </div>

 <div className={styles.formGroup}>
 <label htmlFor="estimatedDuration" className={styles.label}>
 Duration (minutes)
 </label>
 <input
 type="number"
 id="estimatedDuration"
 name="estimatedDuration"
 value={formData.estimatedDuration}
 onChange={handleChange}
 className={styles.input}
 min="1"
 />
 </div>
 </div>

 <div className={styles.formGroup}>
 <label htmlFor="tags" className={styles.label}>
 Tags (comma-separated)
 </label>
 <input
 type="text"
 id="tags"
 name="tags"
 value={formData.tags}
 onChange={handleChange}
 className={styles.input}
 placeholder="work, personal, urgent"
 />
 </div>

 {categories.length > 0 && (
 <div className={styles.formGroup}>
 <fieldset className={styles.fieldset}>
 <legend className={styles.legend}>Categories</legend>
 <div className={styles.checkboxGroup}>
 {categories.map((category) => (
 <label key={category.id} className={styles.checkboxLabel}>
 <input
 type="checkbox"
 checked={formData.categoryIds.includes(category.id)}
 onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
 className={styles.checkbox}
 />
 <span 
 className={styles.categoryName}
 style={{ backgroundColor: category.color || '#e5e7eb' }}
 >
 {category.name}
 </span>
 </label>
 ))}
 </div>
 </fieldset>
 </div>
 )}
 </div>

 <div className={styles.formFooter}>
 <button
 type="button"
 onClick={onCancel}
 className={styles.cancelButton}
 >
 Cancel
 </button>
 <button
 type="submit"
 className={styles.submitButton}
 >
 {task ? 'Update Task' : 'Create Task'}
 </button>
 </div>
 </form>
 );
};

export default TaskForm;