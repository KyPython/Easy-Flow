// Mock data for the RPA dashboard

// Task types available in the automation system
export const TaskType = {
  INVOICE_DOWNLOAD: 'invoice_download',
  DATA_EXTRACTION: 'data_extraction',
  FORM_SUBMISSION: 'form_submission',
  WEB_SCRAPING: 'web_scraping'
};

// Task execution status
export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// User roles for the business application
export const UserRole = {
  FOUNDER: 'founder',
  ADMIN: 'admin',
  USER: 'user'
};

export const mockStore = {
  user: {
    id: 1,
    name: "Sarah Chen",
    email: "sarah@startup.com",
    role: "founder",
    company: "TechFlow Solutions"
  },
  tasks: [
    {
      id: 1,
      type: "invoice_download",
      status: "completed",
      url: "https://vendor-portal.example.com",
      username: "sarah@startup.com",
      created_at: "2024-01-15T10:30:00Z",
      completed_at: "2024-01-15T10:32:15Z",
      result: { message: "Automation executed successfully!", pdf: "/downloads/invoice_20240115.pdf" }
    },
    {
      id: 2,
      type: "data_extraction",
      status: "in_progress",
      url: "https://crm.example.com/leads",
      username: "sarah@startup.com",
      created_at: "2024-01-15T11:00:00Z"
    },
    {
      id: 3,
      type: "form_submission",
      status: "failed",
      url: "https://gov-portal.example.com/forms",
      username: "admin",
      created_at: "2024-01-15T09:15:00Z",
      error: "Authentication failed"
    }
  ],
  metrics: {
    totalTasks: 156,
    completedTasks: 142,
    failedTasks: 14,
    timeSavedHours: 89,
    documentsProcessed: 234
  }
};

export const mockQuery = {
  automationLogs: [
    {
      id: 1,
      task: "invoice_download",
      url: "https://vendor-portal.example.com",
      username: "sarah@startup.com",
      result: { message: "Automation executed successfully!", pdf: "/downloads/invoice_20240115.pdf" },
      created_at: "2024-01-15T10:30:00Z"
    },
    {
      id: 2,
      task: "data_extraction",
      url: "https://crm.example.com/leads",
      username: "sarah@startup.com",
      result: { message: "Data extracted successfully", records: 45 },
      created_at: "2024-01-15T09:45:00Z"
    }
  ]
};

export const mockRootProps = {
  initialTask: {
    url: "",
    username: "",
    password: "",
    task: "invoice_download",
    pdf_url: ""
  }
};