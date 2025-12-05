// Re-export types from backend
export type {
  User,
  Task,
  TaskCategory,
  AccessibilitySettings,
  GameProgress,
  Notification,
  ApiResponse,
  PaginatedResponse
} from '../../../backend/src/types';

// Additional frontend-specific types
export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
}

export interface UIState {
  theme: 'light' | 'dark' | 'high_contrast' | 'auto';
  sidebarOpen: boolean;
  loading: boolean;
  error: string | null;
  currentView: string;
  modals: ModalState[];
}

export interface ModalState {
  id: string;
  type: string;
  props: Record<string, any>;
  isOpen: boolean;
}

export interface ChartDataPoint {
  date: string;
  completed: number;
  created: number;
  pending: number;
}

// Enums
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export enum NotificationType {
  TASK_REMINDER = 'task_reminder',
  ACHIEVEMENT = 'achievement',
  SYSTEM = 'system'
}

export enum ColorBlindMode {
  PROTANOPIA = 'protanopia',
  DEUTERANOPIA = 'deuteranopia',
  TRITANOPIA = 'tritanopia'
}

export enum GameAchievement {
  FIRST_TASK = 'first_task',
  EARLY_BIRD = 'early_bird',
  STREAK_MASTER = 'streak_master',
  COMPLETIONIST = 'completionist',
  ACCESSIBILITY_CHAMPION = 'accessibility_champion'
}

export enum ViewMode {
  LIST = 'list',
  KANBAN = 'kanban',
  CALENDAR = 'calendar',
  GRID = 'grid'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export enum DeviceType {
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  MOBILE = 'mobile'
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  HIGH_CONTRAST = 'high_contrast',
  AUTO = 'auto'
}