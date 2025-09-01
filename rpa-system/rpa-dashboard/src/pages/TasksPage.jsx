import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import TaskForm from "../components/TaskForm/TaskForm";
import { getTasks, createTask } from "../utils/api";

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError("");

      // 1. Get the current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // 2. Check if a session exists before making the API call
      if (sessionError || !session) {
        setError("You must be logged in to view tasks.");
        setLoading(false);
        return; // Stop execution if no valid session
      }

      try {
        const data = await getTasks();
        setTasks(data);
      } catch (err) {
        // Replaced "Backend unavailable" with a more general message
        setError("Failed to load tasks.");
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleCreateTask = async (taskData) => {
    try {
      const newTask = await createTask(taskData);
      setTasks((prev) => [...prev, newTask]);
    } catch (err) {
      setError("Failed to create task.");
    }
  };

  return (
    <div className="tasks-page">
      <div className="task-form-container">
        <TaskForm onSubmit={handleCreateTask} />
      </div>
      {loading ? (
        <div className="loading">Loading tasks...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <ul className="tasks-list">
          {tasks.map((task) => (
            <li key={task.id} className="task-item">
              <div className="task-title">{task.title}</div>
              <div className="task-desc">{task.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TasksPage;