# Code Generator for EasyFlow

> **"Code Generators"** - The Pragmatic Programmer

This tool helps eliminate repetitive boilerplate code by generating common patterns from templates, adapted from [code-generator-tool](https://github.com/KyPython/code-generator-tool).

## 🎯 Overview

The EasyFlow code generator creates boilerplate code following project conventions:

- ✅ **Backend Routes** - Express routes with observability, rate limiting, and Supabase integration
- ✅ **Backend Services** - Service classes with database instrumentation
- ✅ **React Components** - Frontend components with theme support
- ✅ **Python Automation** - Automation modules for the Python worker

## 🚀 Quick Start

### Generate a Route

```bash
# Generate a route file
./scripts/code-generator.sh route User

# Or use npm script
npm run gen:route User
```

This creates `rpa-system/backend/routes/userRoutes.js` with:
- GET, POST, PUT, DELETE endpoints
- Supabase integration
- Structured logging
- Rate limiting
- Error handling

### Generate a Service

```bash
# Generate a service class
./scripts/code-generator.sh service PaymentService

# Or use npm script
npm run gen:service PaymentService
```

This creates `rpa-system/backend/services/PaymentService.js` with:
- CRUD operations
- Database instrumentation
- Error handling
- Structured logging

### Generate a Component

```bash
# Generate a React component
./scripts/code-generator.sh component UserProfile

# Or use npm script
npm run gen:component UserProfile
```

This creates:
- `rpa-system/rpa-dashboard/src/components/UserProfile/UserProfile.jsx`
- `rpa-system/rpa-dashboard/src/components/UserProfile/UserProfile.css`

With:
- Theme support
- Loading/error states
- API integration structure

### Generate an Automation Module

```bash
# Generate a Python automation module
./scripts/code-generator.sh automation InvoiceProcessor

# Or use npm script
npm run gen:automation InvoiceProcessor
```

This creates `rpa-system/automation/automation-service/invoice_processor.py` with:
- Task processing structure
- Validation logic
- Error handling
- Logging

## 📋 Options

### Output Directory

```bash
# Generate in a specific directory
./scripts/code-generator.sh route User --output custom/path
```

### Force Overwrite

```bash
# Overwrite existing files without prompting
./scripts/code-generator.sh route User --force
```

## 🎨 Template Placeholders

Templates support the following placeholders:

| Placeholder | Example (User) | Description |
|------------|----------------|-------------|
| `__NAME__` | `USER` | Uppercase |
| `__Name__` | `User` | PascalCase |
| `__name__` | `user` | camelCase |
| `__name-plural__` | `users` | Plural camelCase |
| `__NAME_PLURAL__` | `USERS` | Plural uppercase |

## 📁 Generated File Structure

### Route File

```javascript
// rpa-system/backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
// ... includes:
// - Supabase client initialization
// - Rate limiting
// - Context logging middleware
// - CRUD endpoints (GET, POST, PUT, DELETE)
```

### Service File

```javascript
// rpa-system/backend/services/UserService.js
class UserService {
  constructor() {
    // Supabase client with instrumentation
  }
  // Methods: getAll(), getById(), create(), update(), delete()
}
```

### Component File

```jsx
// rpa-system/rpa-dashboard/src/components/UserProfile/UserProfile.jsx
const UserProfile = () => {
  const { theme } = useTheme();
  // Includes: loading states, error handling, API integration
}
```

### Automation Module

```python
# rpa-system/automation/automation-service/invoice_processor.py
class InvoiceProcessor:
    def process(self, task_data):
        # Task processing logic
    def validate(self, task_data):
        # Validation logic
```

## 🔧 Customization

### After Generation

1. **Review the generated code** - Ensure it matches your needs
2. **Customize business logic** - Add your specific implementation
3. **Update database schema** - Create tables if needed
4. **Add to app.js** - Register routes in the main app file
5. **Add tests** - Write tests for your new code

### Example: Adding a Route to app.js

```javascript
// In rpa-system/backend/app.js
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
```

## 🎓 Principles from The Pragmatic Programmer

This tool embodies "Code Generators" principles:

1. **Eliminate Repetition** - Don't Repeat Yourself (DRY)
2. **Maintain Consistency** - Generated code follows the same structure
3. **Save Time** - Reduce manual coding errors
4. **Document Patterns** - Templates serve as living documentation

## 📚 Examples

### Complete Workflow

```bash
# 1. Generate route
npm run gen:route Product

# 2. Generate service
npm run gen:service ProductService

# 3. Review generated files
# rpa-system/backend/routes/productRoutes.js
# rpa-system/backend/services/ProductService.js

# 4. Add route to app.js
# app.use('/api/products', productRoutes);

# 5. Customize business logic
# Edit the generated files as needed
```

### Multiple Files

```bash
# Generate multiple routes
npm run gen:route User
npm run gen:route Product
npm run gen:route Order

# Generate corresponding services
npm run gen:service UserService
npm run gen:service ProductService
npm run gen:service OrderService
```

## ⚠️ Important Notes

1. **Database Tables** - Generated code assumes database tables exist. Create them manually or via migrations.

2. **Authentication** - Routes don't include authentication by default. Add auth middleware as needed.

3. **Validation** - Basic validation is included. Add custom validation logic for your use case.

4. **Error Handling** - Standard error handling is included. Customize for your error response format.

5. **Testing** - Generated code should be tested. Add unit and integration tests.

## 🔗 Integration with EasyFlow

The generator follows EasyFlow's patterns:

- ✅ Structured logging with context
- ✅ Supabase database integration
- ✅ Rate limiting middleware
- ✅ Theme-aware React components
- ✅ Observability instrumentation
- ✅ Error handling conventions

## 📖 References

- [Code Generator Tool](https://github.com/KyPython/code-generator-tool) - Original tool
- [The Pragmatic Programmer](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/) - Code Generators chapter

---

**Remember**: Code generators save time and reduce errors, but always review and customize the generated code for your specific needs.

