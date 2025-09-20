import TaskForm from "../components/TaskForm/TaskForm";
import Chatbot from "../components/Chatbot/Chatbot";
import { useI18n } from '../i18n';
import PlanGate from '../components/PlanGate/PlanGate';

const TasksPage = () => {
  const handleTaskSubmit = (completedTask) => {
    // TaskForm handles everything
  };

  const { t } = useI18n();
  return (
    <PlanGate feature="task_automation" upgradeMessage="Task automation is available on paid plans. Upgrade to unlock task creation and automation.">
      <div className="tasks-page">
        <div className="task-form-container">
          <TaskForm onTaskSubmit={handleTaskSubmit} />
        </div>
        <Chatbot />
      </div>
    </PlanGate>
  );
};

export default TasksPage;