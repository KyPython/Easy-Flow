// Folder and tag management utilities for EasyFlow
// Provides folder structure management, navigation, and tag organization

// Predefined system folders
export const SYSTEM_FOLDERS = {
  ROOT: {
    id: 'root',
    name: 'Root',
    path: '/',
    icon: '🏠',
    description: 'Main folder',
    system: true
  },
  UPLOADS: {
    id: 'uploads',
    name: 'Uploads',
    path: '/uploads',
    icon: '📤',
    description: 'Recently uploaded files',
    system: true
  },
  AUTOMATION: {
    id: 'automation',
    name: 'Automation',
    path: '/automation',
    icon: '🤖',
    description: 'Automation workflow files',
    system: true
  },
  DOCUMENTS: {
    id: 'documents',
    name: 'Documents',
    path: '/documents',
    icon: '📄',
    description: 'Document files',
    system: true
  },
  IMAGES: {
    id: 'images',
    name: 'Images',
    path: '/images',
    icon: '🖼️',
    description: 'Image files',
    system: true
  },
  ARCHIVES: {
    id: 'archives',
    name: 'Archives',
    path: '/archives',
    icon: '📦',
    description: 'Archived and old files',
    system: true
  }
};

/**
 * Normalize folder path for consistent handling
 * @param {string} path - Raw folder path
 * @returns {string} - Normalized path
 */
export const normalizePath = (path) => {
  if (!path || path === '/') return '/';
  
  // Remove trailing slash, ensure leading slash
  const normalized = ('/' + path).replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized === '' ? '/' : normalized;
};

/**
 * Get folder breadcrumbs from path
 * @param {string} path - Current folder path
 * @returns {Array} - Array of breadcrumb objects
 */
export const getBreadcrumbs = (path) => {
  const normalizedPath = normalizePath(path);
  
  if (normalizedPath === '/') {
    return [{ name: 'Root', path: '/', icon: '🏠' }];
  }
  
  const parts = normalizedPath.split('/').filter(Boolean);
  const breadcrumbs = [{ name: 'Root', path: '/', icon: '🏠' }];
  
  let currentPath = '';
  parts.forEach((part, index) => {
    currentPath += '/' + part;
    breadcrumbs.push({
      name: part.charAt(0).toUpperCase() + part.slice(1),
      path: currentPath,
      icon: index === parts.length - 1 ? '📁' : '📂'
    });
  });
  
  return breadcrumbs;
};

/**
 * Get parent folder path
 * @param {string} path - Current folder path
 * @returns {string} - Parent folder path
 */
export const getParentPath = (path) => {
  const normalizedPath = normalizePath(path);
  
  if (normalizedPath === '/') return '/';
  
  const parts = normalizedPath.split('/').filter(Boolean);
  parts.pop();
  
  return parts.length === 0 ? '/' : '/' + parts.join('/');
};

/**
 * Get folder name from path
 * @param {string} path - Folder path
 * @returns {string} - Folder name
 */
export const getFolderName = (path) => {
  const normalizedPath = normalizePath(path);
  
  if (normalizedPath === '/') return 'Root';
  
  const parts = normalizedPath.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || 'Root';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/**
 * Validate folder name
 * @param {string} name - Folder name to validate
 * @returns {Object} - Validation result
 */
export const validateFolderName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Folder name is required' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Folder name cannot be empty' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Folder name must be 50 characters or less' };
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(trimmed)) {
    return { valid: false, error: 'Folder name contains invalid characters' };
  }
  
  // Check for reserved names
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reserved.includes(trimmed.toUpperCase())) {
    return { valid: false, error: 'Folder name is reserved' };
  }
  
  return { valid: true, name: trimmed };
};

/**
 * Create new folder path
 * @param {string} parentPath - Parent folder path
 * @param {string} folderName - New folder name
 * @returns {string} - New folder path
 */
export const createFolderPath = (parentPath, folderName) => {
  const validation = validateFolderName(folderName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const normalizedParent = normalizePath(parentPath);
  const safeName = validation.name.toLowerCase().replace(/\s+/g, '-');
  
  return normalizedParent === '/' ? `/${safeName}` : `${normalizedParent}/${safeName}`;
};

/**
 * Build folder tree structure from flat folder list
 * @param {Array} folders - Flat array of folder objects
 * @returns {Array} - Hierarchical folder tree
 */
export const buildFolderTree = (folders = []) => {
  const tree = [];
  const lookup = {};
  
  // Add root folder
  const rootFolder = {
    id: 'root',
    name: 'Root',
    path: '/',
    icon: '🏠',
    children: [],
    system: true,
    expanded: true
  };
  
  lookup['/'] = rootFolder;
  tree.push(rootFolder);
  
  // Sort folders by path depth and name
  const sortedFolders = [...folders].sort((a, b) => {
    const aDepth = (a.folder_path || '/').split('/').length;
    const bDepth = (b.folder_path || '/').split('/').length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return (a.name || '').localeCompare(b.name || '');
  });
  
  // Build tree structure
  sortedFolders.forEach(folder => {
    const folderObj = {
      id: folder.id || folder.folder_path,
      name: getFolderName(folder.folder_path || folder.path),
      path: normalizePath(folder.folder_path || folder.path),
      icon: folder.icon || '📁',
      children: [],
      system: folder.system || false,
      expanded: false,
      fileCount: folder.file_count || 0,
      createdAt: folder.created_at,
      description: folder.description
    };
    
    lookup[folderObj.path] = folderObj;
    
    // Find parent and add to children
    const parentPath = getParentPath(folderObj.path);
    const parent = lookup[parentPath];
    
    if (parent) {
      parent.children.push(folderObj);
    } else {
      // Orphaned folder, add to root
      rootFolder.children.push(folderObj);
    }
  });
  
  return tree;
};

/**
 * Get all folders in a flat array from tree
 * @param {Array} tree - Folder tree
 * @returns {Array} - Flat array of folders
 */
export const flattenFolderTree = (tree = []) => {
  const flattened = [];
  
  const traverse = (nodes) => {
    nodes.forEach(node => {
      flattened.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };
  
  traverse(tree);
  return flattened;
};

/**
 * Find folder in tree by path
 * @param {Array} tree - Folder tree
 * @param {string} path - Folder path to find
 * @returns {Object|null} - Folder object or null
 */
export const findFolderByPath = (tree = [], path) => {
  const normalizedPath = normalizePath(path);
  
  const search = (nodes) => {
    for (const node of nodes) {
      if (node.path === normalizedPath) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  return search(tree);
};

/**
 * Tag management utilities
 */

// Predefined tag colors
export const TAG_COLORS = [
  { name: 'Blue', value: 'var(--color-primary-600)', bg: 'var(--color-primary-50)' },
  { name: 'Green', value: 'var(--color-success-600)', bg: 'var(--color-success-50)' },
  { name: 'Purple', value: 'var(--color-secondary-600, var(--color-primary-600))', bg: 'var(--color-secondary-50, var(--color-primary-50))' },
  { name: 'Red', value: 'var(--color-error-600)', bg: 'var(--color-error-50)' },
  { name: 'Orange', value: 'var(--color-warning-600)', bg: 'var(--color-warning-50)' },
  { name: 'Pink', value: 'var(--color-pink-600, var(--color-secondary-600, var(--color-primary-600)))', bg: 'var(--color-pink-50, var(--color-secondary-50, var(--color-primary-50)))' },
  { name: 'Teal', value: 'var(--color-teal-600, var(--color-success-600))', bg: 'var(--color-teal-50, var(--color-success-50))' },
  { name: 'Gray', value: 'var(--color-gray-600)', bg: 'var(--color-gray-100)' }
];

/**
 * Get tag statistics from files
 * @param {Array} files - Array of file objects
 * @returns {Array} - Array of tag statistics
 */
export const getTagStats = (files = []) => {
  const tagCounts = {};
  const tagLastUsed = {};
  
  files.forEach(file => {
    if (file.tags && Array.isArray(file.tags)) {
      file.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        
        const fileDate = new Date(file.created_at || file.updated_at);
        if (!tagLastUsed[tag] || fileDate > tagLastUsed[tag]) {
          tagLastUsed[tag] = fileDate;
        }
      });
    }
  });
  
  return Object.keys(tagCounts)
    .map(tag => ({
      name: tag,
      count: tagCounts[tag],
      lastUsed: tagLastUsed[tag],
      color: TAG_COLORS[tag.length % TAG_COLORS.length]
    }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Clean and validate tags array
 * @param {Array} tags - Raw tags array
 * @returns {Array} - Cleaned tags array
 */
export const cleanTags = (tags = []) => {
  if (!Array.isArray(tags)) return [];
  
  return [...new Set(
    tags
      .map(tag => String(tag).trim().toLowerCase())
      .filter(tag => tag && tag.length > 0 && tag.length <= 50)
  )].slice(0, 20); // Limit to 20 unique tags
};

/**
 * Get suggested tags based on filename and existing tags
 * @param {string} filename - File name
 * @param {Array} existingTags - Array of existing tag statistics
 * @returns {Array} - Suggested tags
 */
export const getSuggestedTags = (filename = '', existingTags = []) => {
  const suggestions = new Set();
  const lowerName = filename.toLowerCase();
  
  // Add filename-based suggestions
  if (lowerName.includes('invoice')) suggestions.add('invoice');
  if (lowerName.includes('receipt')) suggestions.add('receipt');
  if (lowerName.includes('contract')) suggestions.add('contract');
  if (lowerName.includes('report')) suggestions.add('report');
  if (lowerName.includes('template')) suggestions.add('template');
  if (lowerName.includes('draft')) suggestions.add('draft');
  if (lowerName.includes('final')) suggestions.add('final');
  if (lowerName.includes('backup')) suggestions.add('backup');
  
  // Add popular existing tags
  existingTags
    .slice(0, 5)
    .forEach(tagStat => suggestions.add(tagStat.name));
  
  return Array.from(suggestions).slice(0, 8);
};

/**
 * Export utilities for drag & drop
 */

/**
 * Check if drag operation is valid
 * @param {Object} dragData - Drag data object
 * @param {string} targetPath - Target folder path
 * @returns {boolean} - Whether drop is valid
 */
export const isValidDrop = (dragData, targetPath) => {
  if (!dragData || !targetPath) return false;
  
  // Don't allow dropping into same folder
  if (dragData.currentPath === normalizePath(targetPath)) return false;
  
  // Don't allow dropping folder into its own subfolder
  if (dragData.type === 'folder') {
    const normalizedTarget = normalizePath(targetPath);
    const normalizedSource = normalizePath(dragData.path);
    
    if (normalizedTarget.startsWith(normalizedSource + '/')) {
      return false;
    }
  }
  
  return true;
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};