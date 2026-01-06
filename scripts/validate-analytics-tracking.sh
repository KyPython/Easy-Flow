#!/bin/bash
# Validate Analytics Tracking - Critical Business Metrics
# Ensures feature tracking, signup tracking, and login tracking are working

set -e

echo "🔍 Validating Analytics Tracking..."
echo ""

ERRORS=0
WARNINGS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to count errors
increment_error() {
    ERRORS=$((ERRORS + 1))
    echo -e "${RED}❌ $1${NC}"
}

# Function to count warnings
increment_warning() {
    WARNINGS=$((WARNINGS + 1))
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to show success
show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 1. Check trackFeatureUsage() is being called in key components
echo "📊 1. Checking Feature Usage Tracking..."
echo ""

FEATURE_TRACKING_FOUND=0

# Check for trackFeatureUsage calls in key files
KEY_FILES=(
    "rpa-system/rpa-dashboard/src/pages/DashboardPage.jsx"
    "rpa-system/rpa-dashboard/src/components/WorkflowBuilder/WorkflowBuilder.jsx"
    "rpa-system/rpa-dashboard/src/components/WorkflowBuilder/TemplateGallery.jsx"
)

for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check for trackFeatureUsage import or usage (case insensitive, flexible whitespace)
        if grep -qi "trackFeatureUsage\|track.*Feature" "$file" 2>/dev/null; then
            FEATURE_TRACKING_FOUND=$((FEATURE_TRACKING_FOUND + 1))
            show_success "Found trackFeatureUsage() in $file"
        else
            increment_error "Missing trackFeatureUsage() in $file"
        fi
    else
        increment_warning "File not found: $file"
    fi
done

if [ $FEATURE_TRACKING_FOUND -eq 0 ]; then
    increment_error "No trackFeatureUsage() calls found in key components"
else
    show_success "Feature usage tracking found in $FEATURE_TRACKING_FOUND key component(s)"
fi

echo ""

# 2. Check signup tracking
echo "📊 2. Checking Signup Tracking..."
echo ""

# Check frontend signup tracking
if grep -q "trackEvent.*user_signup\|trackEvent.*signup" rpa-system/rpa-dashboard/src/pages/AuthPage.jsx 2>/dev/null; then
    show_success "Frontend signup tracking found in AuthPage.jsx"
else
    increment_error "Missing signup tracking in AuthPage.jsx"
fi

# Check backend signup tracking (in ensureUserProfile or similar)
if grep -q "user_signup" rpa-system/backend/app.js 2>/dev/null && grep -q "marketing_events" rpa-system/backend/app.js 2>/dev/null; then
    show_success "Backend signup tracking found"
else
    increment_error "Missing backend signup tracking"
fi

echo ""

# 3. Check login tracking
echo "📊 3. Checking Login Tracking..."
echo ""

# Check frontend login tracking
if grep -q "login_success\|user_login" rpa-system/rpa-dashboard/src/pages/AuthPage.jsx 2>/dev/null; then
    show_success "Frontend login tracking found"
else
    increment_error "Missing frontend login tracking"
fi

# Check backend login tracking
if grep -q "login_success\|login_failed" rpa-system/backend/app.js 2>/dev/null && grep -q "marketing_events" rpa-system/backend/app.js 2>/dev/null; then
    show_success "Backend login tracking found"
else
    increment_error "Missing backend login tracking"
fi

echo ""

# 4. Check backend tracking endpoint exists and logs events
echo "📊 4. Checking Backend Tracking Endpoint..."
echo ""

if grep -q "/api/track-event" rpa-system/backend/app.js 2>/dev/null; then
    show_success "Backend /api/track-event endpoint exists"
    
    # Check if it logs to observability
    if grep -q "\[track-event\]" rpa-system/backend/app.js 2>/dev/null; then
        show_success "Backend tracking endpoint logs to observability"
    else
        increment_warning "Backend tracking endpoint may not be logging to observability"
    fi
    
    # Check if it handles feature_used events
    if grep -q "feature_used\|feature_" rpa-system/backend/app.js 2>/dev/null; then
        show_success "Backend handles feature_used events"
    else
        increment_warning "Backend may not properly handle feature_used events"
    fi
else
    increment_error "Backend /api/track-event endpoint not found"
fi

echo ""

# 5. Check analytics health endpoint
echo "📊 5. Checking Analytics Health Endpoint..."
echo ""

if grep -q "analytics-health" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
    show_success "Analytics health endpoint exists"
    
    # Check if it checks feature tracking
    if grep -q "feature_tracking\|feature_used" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
        show_success "Analytics health checks feature tracking"
    else
        increment_error "Analytics health endpoint doesn't check feature tracking"
    fi
    
    # Check if it checks signup tracking
    if grep -q "signup.*tracking\|user_signup" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
        show_success "Analytics health checks signup tracking"
    else
        increment_error "Analytics health endpoint doesn't check signup tracking"
    fi
    
    # Check if it checks login tracking
    if grep -q "login.*health\|login_success\|login_failed" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
        show_success "Analytics health checks login tracking"
    else
        increment_error "Analytics health endpoint doesn't check login tracking"
    fi
else
    increment_error "Analytics health endpoint not found"
fi

echo ""

# 6. Check feature discovery query handles feature_used events
echo "📊 6. Checking Feature Discovery Query..."
echo ""

if grep -q "feature_used\|feature_" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
    # Check if query includes both feature_* and feature_used
    if grep -q "or.*feature_used\|feature_used\|like.*feature_%" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
        show_success "Feature discovery query handles feature_used events"
    else
        increment_error "Feature discovery query may not handle feature_used events properly"
    fi
    
    # Check if it extracts feature name from properties
    if grep -q "properties.*feature\|properties\?\.feature" rpa-system/backend/routes/businessMetrics.js 2>/dev/null; then
        show_success "Feature discovery extracts feature name from properties"
    else
        increment_error "Feature discovery may not extract feature name from properties"
    fi
else
    increment_error "Feature discovery query not found or incomplete"
fi

echo ""

# 7. Check workflow creation tracking
echo "📊 7. Checking Workflow Creation Tracking..."
echo ""

if grep -q "feature_used.*workflow\|trackWorkflowChange" rpa-system/backend/utils/usageTracker.js 2>/dev/null; then
    show_success "Workflow creation tracking found"
else
    increment_warning "Workflow creation may not be tracked as feature usage"
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Analytics Tracking Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    show_success "All analytics tracking checks passed!"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Validation completed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Warnings are non-blocking but should be reviewed."
    exit 0
else
    increment_error "Validation failed with $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    echo "Errors must be fixed before production deployment."
    echo "Analytics tracking is critical for business metrics."
    exit 1
fi

