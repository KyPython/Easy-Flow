import TaskForm from "../components/TaskForm/TaskForm";
import Chatbot from "../components/Chatbot/Chatbot";
import { useI18n } from '../i18n';

const TasksPage = () => {
  const handleTaskSubmit = (completedTask) => {
    console.log('Task submitted successfully:', completedTask);
    // TaskForm handles everything - just log for debugging
  };

  const { t } = useI18n();
  return (
    <div className="tasks-page">
      <div className="task-form-container">
        <TaskForm onTaskSubmit={handleTaskSubmit} />
      </div>
      
      <Chatbot />
    </div>
  );
};

export default TasksPage;