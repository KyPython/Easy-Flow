import { useState, useEffect } from 'react';
import { Task, TaskCategory, TaskStats, TaskStatus } from '../types';
import { mockQuery } from '../data/accessibleOSMockData';
import { useAuth } from '../utils/AuthContext';
import apiClient from '../lib/apiClient';

interface UseTasksOptions {
  status?: string;
  priority?: string;
  categoryId?: string;
  parentTaskId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UseTasksReturn {
  tasks: Task[];
  categories: TaskCategory[];
  stats: TaskStats;
  loading: boolean;
  error: string | null;
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useTasks = (options: UseTasksOptions = {}): UseTasksReturn => {
  const auth = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    overdue: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to call backend API
      try {
        const token = auth?.session?.access_token || null;
        const body = await apiClient.get('/accessibleos/tasks', token);
        if (body && body.data) {
          setTasks(body.data || []);
          setCategories(body.categories || []);
          setStats({
            total: body.total || 0,
            completed: 0,
            pending: 0,
            inProgress: 0,
            overdue: 0,
            completedToday: 0,
            completedThisWeek: 0,
            completedThisMonth: 0
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        // fall back to mock
        console.warn('API fetch tasks failed, falling back to mock', e);
      }

      // Simulate API call fallback
      await new Promise(resolve => setTimeout(resolve, 500));
      let filteredTasks = [...mockQuery.tasks];
      
      // Apply filters
      if (options.status) {
        filteredTasks = filteredTasks.filter(task => task.status === options.status);
      }
      
      if (options.priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === options.priority);
      }
      
      if (options.categoryId) {
        filteredTasks = filteredTasks.filter(task => 
          task.categories.some(cat => cat.id === options.categoryId)
        );
      }
      
      // Apply sorting
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      
      filteredTasks.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortBy) {
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case 'priority':
            const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 };
            aValue = priorityOrder[a.priority];
            bValue = priorityOrder[b.priority];
            break;
          case 'due_date':
            aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            break;
          default:
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
      
      // Apply pagination
      if (options.limit) {
        const startIndex = ((options.page || 1) - 1) * options.limit;
        filteredTasks = filteredTasks.slice(startIndex, startIndex + options.limit);
      }
      
      setTasks(filteredTasks);
      setCategories(mockQuery.categories);
      
      // Calculate stats
      const allTasks = mockQuery.tasks;
      const newStats: TaskStats = {
        total: allTasks.length,
        completed: allTasks.filter(task => String(task.status) === TaskStatus.COMPLETED || String(task.status) === 'completed').length,
        pending: allTasks.filter(task => String(task.status) === TaskStatus.PENDING || String(task.status) === 'pending').length,
        inProgress: allTasks.filter(task => String(task.status) === TaskStatus.IN_PROGRESS || String(task.status) === 'in_progress').length,
        overdue: allTasks.filter(task => 
          task.dueDate && new Date(task.dueDate) < new Date() && 
          (String(task.status) !== TaskStatus.COMPLETED && String(task.status) !== 'completed')
        ).length,
        completedToday: allTasks.filter(task => 
          (String(task.status) === TaskStatus.COMPLETED || String(task.status) === 'completed') && 
          task.completedAt && 
          new Date(task.completedAt).toDateString() === new Date().toDateString()
        ).length,
        completedThisWeek: allTasks.filter(task => String(task.status) === TaskStatus.COMPLETED || String(task.status) === 'completed').length,
        completedThisMonth: allTasks.filter(task => String(task.status) === TaskStatus.COMPLETED || String(task.status) === 'completed').length
      };
      
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = useAuth();
      const token = auth?.session?.access_token || null;
      const body = await apiClient.post('/accessibleos/tasks', taskData, token);
      const newTask = body.data as Task;
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = useAuth();
      const token = auth?.session?.access_token || null;
      const body = await apiClient.put(`/accessibleos/tasks/${taskId}`, updates, token);
      const updated = body.data as Task;
      setTasks(prev => prev.map(tk => tk.id === taskId ? updated : tk));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = useAuth();
      const token = auth?.session?.access_token || null;
      await apiClient.del(`/accessibleos/tasks/${taskId}`, token);
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refetch = async (): Promise<void> => {
    await fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, [options.status, options.priority, options.categoryId, options.sortBy, options.sortOrder]);

  return {
    tasks,
    categories,
    stats,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refetch
  };
};