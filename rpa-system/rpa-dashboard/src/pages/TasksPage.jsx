import TaskForm from "../components/TaskForm/TaskForm";
import Chatbot from "../components/Chatbot/Chatbot";

const TasksPage = () => {
  const handleTaskSubmit = (completedTask) => {
    console.log('Task submitted successfully:', completedTask);
    // TaskForm handles everything - just log for debugging
  };

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