#!/bin/bash

# Update hardcoded colors to CSS variables in our new CSS files
CSS_FILES=(
  "rpa-system/rpa-dashboard/src/components/ScheduleBuilder/CronBuilder.module.css"
  "rpa-system/rpa-dashboard/src/components/ScheduleBuilder/ScheduleEditor.module.css"
  "rpa-system/rpa-dashboard/src/components/TeamManagement/InviteModal.module.css"
  "rpa-system/rpa-dashboard/src/components/TeamManagement/RoleManager.module.css"
  "rpa-system/rpa-dashboard/src/components/Analytics/ReportsGenerator.module.css"
)

for file in "${CSS_FILES[@]}"; do
  echo "Updating $file..."
  # Replace common hardcoded colors with theme variables
  sed -i.bak \
    -e 's/#3b82f6/var(--color-primary-600)/g' \
    -e 's/#2563eb/var(--color-primary-700)/g' \
    -e 's/#1d4ed8/var(--color-primary-800)/g' \
    -e 's/#dbeafe/var(--color-primary-100)/g' \
    -e 's/#f9fafb/var(--color-gray-50)/g' \
    -e 's/#f3f4f6/var(--color-gray-100)/g' \
    -e 's/#e5e7eb/var(--border-color)/g' \
    -e 's/#d1d5db/var(--color-gray-300)/g' \
    -e 's/#6b7280/var(--text-muted)/g' \
    -e 's/#374151/var(--text-secondary)/g' \
    -e 's/#111827/var(--text-primary)/g' \
    -e 's/#ffffff/var(--surface)/g' \
    -e 's/white/var(--surface)/g' \
    -e 's/#dc2626/var(--color-error-600)/g' \
    -e 's/#059669/var(--color-success-600)/g' \
    -e 's/1rem/var(--spacing-md)/g' \
    -e 's/1\.5rem/var(--spacing-lg)/g' \
    -e 's/2rem/var(--spacing-xl)/g' \
    -e 's/0\.5rem/var(--spacing-sm)/g' \
    -e 's/0\.75rem/var(--spacing-sm)/g' \
    -e 's/0\.375rem/var(--radius-md)/g' \
    -e 's/0\.5rem/var(--radius-md)/g' \
    "$file"
done

echo "All CSS files updated with theme variables!"
