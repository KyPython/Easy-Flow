# EasyFlow Route Map

API endpoint reference for the EasyFlow backend.

## Authentication
All API routes require authentication via Bearer token unless marked as public.

## Core API Routes

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List user's tasks |
| POST | `/api/tasks` | Create a new task |
| GET | `/api/tasks/:id` | Get task details |
| DELETE | `/api/tasks/:id` | Delete a task |

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/:id` | Get workflow |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/workflows/:id/execute` | Execute workflow |

### Workflow Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflow-templates` | List templates |
| GET | `/api/workflow-templates/:id` | Get template |
| POST | `/api/workflow-templates/:id/use` | Create from template |

### Integrations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List integrations |
| POST | `/api/integrations/:provider/connect` | Connect integration |
| DELETE | `/api/integrations/:id` | Disconnect |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List files |
| POST | `/api/files/upload` | Upload file |
| GET | `/api/files/:id/download` | Download file |
| DELETE | `/api/files/:id` | Delete file |

### User & Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get profile |
| PUT | `/api/user/profile` | Update profile |
| GET | `/api/teams` | List teams |
| POST | `/api/teams/invite` | Invite member |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard data |
| GET | `/api/analytics/usage` | Usage metrics |
| GET | `/api/business-metrics/overview` | Business metrics |

## Public Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/signup` | User signup |
| POST | `/api/auth/login` | User login |
| POST | `/api/demo-booking` | Book demo (public) |
| POST | `/api/email-capture` | Capture email (public) |

## Route Files Location
Routes are defined in `rpa-system/backend/routes/`:
- `taskRoutes.js` - Task management
- `workflowRoutes.js` - Workflow CRUD
- `integrationRoutes.js` - Third-party integrations
- `fileRoutes.js` - File management
- `userRoutes.js` - User profile
- `teamRoutes.js` - Team management
- `analyticsRoutes.js` - Analytics data
