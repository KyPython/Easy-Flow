// Mock data for AccessibleOS Task Management Application
import { TaskStatus, TaskPriority, NotificationType, ColorBlindMode, GameAchievement, UserRole } from '../types/index.ts';

// Data for global state store
export const mockStore = {
 user: {
 id: 'user-123',
 firebaseUid: 'firebase-uid-123',
 email: 'john.doe@example.com',
 displayName: 'John Doe',
 profilePictureUrl: 'https://i.pravatar.cc/150?img=1',
 role: UserRole.USER as const,
 isActive: true,
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-20T14:30:00Z',
 lastLogin: '2024-01-20T14:30:00Z'
 },
 accessibilitySettings: {
 id: 'settings-123',
 userId: 'user-123',
 voiceOverEnabled: false,
 voiceOverSpeed: 1.0,
 keyboardNavigationEnabled: true,
 highContrastMode: false,
 fontSizeMultiplier: 1.0,
 screenReaderEnabled: false,
 motionReduced: false,
 colorBlindMode: null,
 customCss: '',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-20T14:30:00Z'
 },
 gameProgress: {
 id: 'game-123',
 userId: 'user-123',
 level: 5,
 experiencePoints: 1250,
 achievements: [GameAchievement.FIRST_TASK, GameAchievement.EARLY_BIRD] as const,
 currentStreak: 7,
 longestStreak: 15,
 tasksCompletedToday: 3,
 lastActivityDate: '2024-01-20',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-20T14:30:00Z'
 },
 uiState: {
 theme: 'light' as const,
 sidebarOpen: false,
 loading: false,
 error: null,
 currentView: 'dashboard',
 modals: []
 }
};


// Data returned by API queries
export const mockQuery = {
 tasks: [
 {
 id: 'task-1',
 userId: 'user-123',
 title: 'Complete project proposal',
 description: 'Finish the Q1 project proposal document with accessibility guidelines',
 status: TaskStatus.IN_PROGRESS as const,
 priority: TaskPriority.HIGH as const,
 dueDate: '2024-01-25T17:00:00Z',
 estimatedDuration: 120,
 actualDuration: 90,
 tags: ['work', 'proposal', 'accessibility'],
 createdAt: '2024-01-18T09:00:00Z',
 updatedAt: '2024-01-20T11:00:00Z',
 sortOrder: 1,
 categories: [
 {
 id: 'cat-1',
 userId: 'user-123',
 name: 'Work',
 color: '#3B82F6',
 icon: 'briefcase',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 }
 ]
 },
 {
 id: 'task-2',
 userId: 'user-123',
 title: 'Schedule doctor appointment',
 description: 'Book annual health checkup and eye exam',
 status: TaskStatus.PENDING as const,
 priority: TaskPriority.MEDIUM as const,
 dueDate: '2024-01-30T12:00:00Z',
 estimatedDuration: 30,
 tags: ['health', 'personal'],
 createdAt: '2024-01-19T14:00:00Z',
 updatedAt: '2024-01-19T14:00:00Z',
 sortOrder: 2,
 categories: [
 {
 id: 'cat-2',
 userId: 'user-123',
 name: 'Health',
 color: '#10B981',
 icon: 'heart',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 }
 ]
 },
 {
 id: 'task-3',
 userId: 'user-123',
 title: 'Learn React accessibility patterns',
 description: 'Study ARIA patterns and screen reader compatibility',
 status: TaskStatus.COMPLETED as const,
 priority: TaskPriority.LOW as const,
 completedAt: '2024-01-19T16:30:00Z',
 estimatedDuration: 180,
 actualDuration: 165,
 tags: ['learning', 'accessibility', 'react'],
 createdAt: '2024-01-16T08:00:00Z',
 updatedAt: '2024-01-19T16:30:00Z',
 sortOrder: 3,
 categories: [
 {
 id: 'cat-3',
 userId: 'user-123',
 name: 'Learning',
 color: '#8B5CF6',
 icon: 'book',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 }
 ]
 }
 ],
 categories: [
 {
 id: 'cat-1',
 userId: 'user-123',
 name: 'Work',
 color: '#3B82F6',
 icon: 'briefcase',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 },
 {
 id: 'cat-2',
 userId: 'user-123',
 name: 'Health',
 color: '#10B981',
 icon: 'heart',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 },
 {
 id: 'cat-3',
 userId: 'user-123',
 name: 'Learning',
 color: '#8B5CF6',
 icon: 'book',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 },
 {
 id: 'cat-4',
 userId: 'user-123',
 name: 'Personal',
 color: '#F59E0B',
 icon: 'user',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-15T10:00:00Z'
 }
 ],
 notifications: [
 {
 id: 'notif-1',
 userId: 'user-123',
 title: 'Task Due Soon',
 message: 'Your task "Complete project proposal" is due in 2 hours',
 type: NotificationType.TASK_REMINDER as const,
 isRead: false,
 scheduledFor: '2024-01-25T15:00:00Z',
 createdAt: '2024-01-25T10:00:00Z',
 metadata: {
 taskId: 'task-1',
 dueDate: '2024-01-25T17:00:00Z'
 }
 },
 {
 id: 'notif-2',
 userId: 'user-123',
 title: 'Achievement Unlocked!',
 message: 'Congratulations! You earned the "Early Bird" achievement',
 type: NotificationType.ACHIEVEMENT as const,
 isRead: true,
 sentAt: '2024-01-20T08:00:00Z',
 createdAt: '2024-01-20T08:00:00Z',
 metadata: {
 achievement: GameAchievement.EARLY_BIRD,
 experiencePoints: 50
 }
 }
 ],
 analytics: {
 taskStats: {
 total: 25,
 completed: 18,
 pending: 4,
 inProgress: 3,
 overdue: 2,
 completedToday: 3,
 completedThisWeek: 12,
 completedThisMonth: 18
 },
 chartData: [
 { date: '2024-01-14', completed: 2, created: 3, pending: 1 },
 { date: '2024-01-15', completed: 1, created: 2, pending: 2 },
 { date: '2024-01-16', completed: 3, created: 1, pending: 1 },
 { date: '2024-01-17', completed: 2, created: 4, pending: 3 },
 { date: '2024-01-18', completed: 4, created: 2, pending: 1 },
 { date: '2024-01-19', completed: 3, created: 1, pending: 0 },
 { date: '2024-01-20', completed: 3, created: 2, pending: 1 }
 ],
 productivityInsights: {
 averageCompletionTime: 95,
 mostProductiveHour: 10,
 mostProductiveDay: 'Tuesday',
 completionRate: 0.72,
 streakData: {
 current: 7,
 longest: 15,
 thisMonth: 12
 }
 }
 }
};

// Data passed as props to the root component
export const mockRootProps = {
 initialRoute: 'dashboard',
 theme: 'light' as const,
 debugMode: false,
 apiBaseUrl: 'http://localhost:3001/api',
 firebaseConfig: {
 apiKey: 'demo-api-key',
 authDomain: 'accessibleos-dev.firebaseapp.com',
 projectId: 'accessibleos-dev',
 storageBucket: 'accessibleos-dev.appspot.com',
 messagingSenderId: '123456789',
 appId: '1:123456789:web:abcdef123456'
 },
 accessibilitySettings: {
 enableScreenReaderAnnouncements: true,
 enableKeyboardNavigation: true,
 enableHighContrast: false,
 fontSizeMultiplier: 1.0
 }
};