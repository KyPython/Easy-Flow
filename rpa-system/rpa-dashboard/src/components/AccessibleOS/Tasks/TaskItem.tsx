import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types';
import styles from './TaskItem.module.css';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (status: Task['status']) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const navigate = useNavigate();
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#ca8a04';
      case 'low':
        return '#16a34a';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '⏳';
      case 'cancelled':
        return '✗';
      default:
        return '○';
    }
  };

  return (
    <div
      className={`${styles.taskItem} ${styles[task.status]}`}
      role="listitem"
    >
      <div className={styles.taskHeader}>
        <div className={styles.statusSection}>
          <button
            className={styles.statusButton}
            onClick={() => {
              const nextStatus =
                task.status === 'completed' ? 'pending' : 'completed';
              onStatusChange(nextStatus);
            }}
            aria-label={`Mark task as ${
              task.status === 'completed' ? 'pending' : 'completed'
            }`}
          >
            {getStatusIcon(task.status)}
          </button>
          <div className={styles.taskInfo}>
            <h3 className={styles.taskTitle}>{task.title}</h3>
            {task.description && (
              <p className={styles.taskDescription}>{task.description}</p>
            )}
          </div>
        </div>

        <div className={styles.taskActions}>
          <button
            className={styles.editButton}
            onClick={() => onEdit(task)}
            aria-label={`Edit task: ${task.title}`}
          >
            Edit
          </button>
          <button
            className={styles.deleteButton}
            onClick={() => onDelete(task.id)}
            aria-label={`Delete task: ${task.title}`}
          >
            Delete
          </button>
          <button
            className={styles.viewButton}
            onClick={() => navigate(`/tasks/${task.id}`)}
            aria-label={`View task: ${task.title}`}
          >
            View
          </button>
        </div>
      </div>

      <div className={styles.taskMeta}>
        <div className={styles.metaItem}>
          <span
            className={styles.priority}
            style={{ backgroundColor: getPriorityColor(task.priority) }}
          >
            {task.priority}
          </span>
        </div>

        {task.dueDate && (
          <div className={styles.metaItem}>
            <span className={styles.dueDate}>
              Due: {formatDate(task.dueDate)}
            </span>
          </div>
        )}

        {task.estimatedDuration && (
          <div className={styles.metaItem}>
            <span className={styles.duration}>{task.estimatedDuration}min</span>
          </div>
        )}

        {task.categories.length > 0 && (
          <div className={styles.categories}>
            {task.categories.map(category => (
              <span
                key={category.id}
                className={styles.category}
                style={{ backgroundColor: category.color || '#e5e7eb' }}
              >
                {category.name}
              </span>
            ))}
          </div>
        )}

        {task.tags.length > 0 && (
          <div className={styles.tags}>
            {task.tags.map((tag, index) => (
              <span key={index} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskItem;
