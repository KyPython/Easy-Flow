# Environment-Aware Messaging Migration Guide

## ✅ Completed Migrations

### Core User-Facing Components
1. **TaskForm.jsx** - ✅ Complete
   - Migrated 15+ console.* calls to logger
   - All error messages use sanitizeErrorMessage()
   - Environment-aware messages via getEnvMessage()

2. **RulesPage.jsx** - ✅ Complete
   - Replaced alert() with toast.error()
   - All setError() wrapped with sanitizeErrorMessage()
   - Environment-aware messages

3. **HistoryPage.jsx** - ✅ Complete
   - All setError() wrapped with sanitizeErrorMessage()
   - Using getEnvMessage() for environment-aware messages

4. **PricingPage.jsx** - ✅ Complete
   - Replaced alert() with toast.error()
   - Error messages wrapped with sanitizeErrorMessage() and getEnvMessage()

5. **IntegrationsPage.jsx** - ✅ Complete
   - Migrated console.error to logger
   - Error messages wrapped with sanitizeErrorMessage() and getEnvMessage()

6. **UnifiedDashboardPage.jsx** - ✅ Complete
   - Error messages wrapped with sanitizeErrorMessage() and getEnvMessage()

7. **TaskList.jsx** - ✅ Complete
   - Migrated console calls to logger

8. **TaskResultModal.jsx** - ✅ Complete
   - Migrated console calls to logger

9. **AuthContext.js** - ✅ Complete
   - Migrated console calls to logger

## 📋 Migration Pattern

### 1. Replace Console Calls

**Before:**
```javascript
console.log('[Component] Message', { data });
console.error('[Component] Error:', error);
console.warn('[Component] Warning');
```

**After:**
```javascript
import { createLogger } from '../utils/logger';
const logger = createLogger('Component');

logger.debug('Message', { data });
logger.error('Error', error);
logger.warn('Warning');
```

### 2. Wrap User-Facing Error Messages

**Before:**
```javascript
setError(err.message || 'Failed to load data');
alert('Error: ' + err.message);
```

**After:**
```javascript
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';

setError(sanitizeErrorMessage(err) || getEnvMessage({
  dev: 'Failed to load data: ' + (err.message || 'Unknown error'),
  prod: 'Failed to load data. Please try again.'
}));
```

### 3. Replace alert() with Toast

**Before:**
```javascript
alert('Failed to delete: ' + err.message);
```

**After:**
```javascript
import { useToast } from '../components/WorkflowBuilder/Toast';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';

const { error: showError } = useToast();

const errorMsg = sanitizeErrorMessage(err) || getEnvMessage({
  dev: 'Failed to delete: ' + (err.message || 'Unknown error'),
  prod: 'Failed to delete. Please try again.'
});
showError(errorMsg);
```

## 🔄 Remaining Files

### High Priority (User-Facing)
- DashboardPage.jsx
- FilesPage.jsx
- TeamPage.jsx
- AnalyticsPage.jsx
- SettingsPage.jsx

### Medium Priority (Components)
- WorkflowBuilder components
- BulkProcessor components
- FileUpload components

### Low Priority (Utilities)
- logger.js (OK - this is the logger itself)
- consoleWrapper.js (OK - wrapper utility)
- devNetLogger.js (OK - network logging utility)
- telemetry.js (OK - observability utility)

## ✅ Testing Checklist

- [ ] Test in development mode - verify technical messages appear
- [ ] Test in production mode - verify user-friendly messages appear
- [ ] Verify no console errors in browser console (production)
- [ ] Verify error messages are actionable and clear
- [ ] Verify toast notifications work correctly
- [ ] Verify logger integration with backend observability

## 📝 Notes

- Logger automatically handles environment awareness
- sanitizeErrorMessage() automatically converts technical errors to user-friendly messages
- getEnvMessage() provides custom environment-aware messages
- All utilities are backward-compatible

