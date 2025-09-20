import TaskForm from "../components/TaskForm/TaskForm";
import Chatbot from "../components/Chatbot/Chatbot";
import { useI18n } from '../i18n';
import { useTheme } from '../utils/ThemeContext';
import styles from './TasksPage.module.css';

const TasksPage = () => {
  const handleTaskSubmit = (completedTask) => {
    // TaskForm handles everything
  };

  const { t } = useI18n();
  const { theme } = useTheme();
  
  return (
    <div className={styles.container}>
      <div className={styles.formSection}>
        <TaskForm onTaskSubmit={handleTaskSubmit} />
      </div>
      <Chatbot />
    </div>
  );
};

export default TasksPage;