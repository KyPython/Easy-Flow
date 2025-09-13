// File categorization system for EasyFlow
// Provides predefined categories, automatic categorization, and utilities

// Prefer theme token names for colors; fall back to hex for non-themed consumers
export const FILE_CATEGORIES = {
  DOCUMENTS: {
    id: 'documents',
    name: 'Documents',
    icon: '📄',
  color: 'var(--color-primary-600)',
    description: 'Text documents, PDFs, presentations'
  },
  IMAGES: {
    id: 'images',
    name: 'Images',
    icon: '🖼️',
  color: 'var(--color-success-600)',
    description: 'Photos, graphics, screenshots'
  },
  VIDEOS: {
    id: 'videos',
    name: 'Videos',
    icon: '🎥',
  color: 'var(--color-secondary-600, var(--color-primary-600))',
    description: 'Video files and recordings'
  },
  AUDIO: {
    id: 'audio',
    name: 'Audio',
    icon: '🎵',
  color: 'var(--color-warning-600)',
    description: 'Music, recordings, sound files'
  },
  SPREADSHEETS: {
    id: 'spreadsheets',
    name: 'Spreadsheets',
    icon: '📊',
  color: 'var(--color-success-700)',
    description: 'Excel, CSV, data files'
  },
  PRESENTATIONS: {
    id: 'presentations',
    name: 'Presentations',
    icon: '📋',
  color: 'var(--color-error-600)',
    description: 'PowerPoint, slide decks'
  },
  ARCHIVES: {
    id: 'archives',
    name: 'Archives',
    icon: '📦',
  color: 'var(--color-gray-500)',
    description: 'ZIP, compressed files'
  },
  CODE: {
    id: 'code',
    name: 'Code',
    icon: '⚙️',
  color: 'var(--text-primary)',
    description: 'Source code, configuration'
  },
  OTHER: {
    id: 'other',
    name: 'Other',
    icon: '📎',
  color: 'var(--text-muted)',
    description: 'Uncategorized files'
  }
};

// MIME type to category mapping
export const MIME_TYPE_CATEGORIES = {
  // Documents
  'application/pdf': FILE_CATEGORIES.DOCUMENTS,
  'application/msword': FILE_CATEGORIES.DOCUMENTS,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FILE_CATEGORIES.DOCUMENTS,
  'application/rtf': FILE_CATEGORIES.DOCUMENTS,
  'text/plain': FILE_CATEGORIES.DOCUMENTS,
  'text/markdown': FILE_CATEGORIES.DOCUMENTS,
  'application/vnd.oasis.opendocument.text': FILE_CATEGORIES.DOCUMENTS,

  // Images
  'image/jpeg': FILE_CATEGORIES.IMAGES,
  'image/jpg': FILE_CATEGORIES.IMAGES,
  'image/png': FILE_CATEGORIES.IMAGES,
  'image/gif': FILE_CATEGORIES.IMAGES,
  'image/webp': FILE_CATEGORIES.IMAGES,
  'image/svg+xml': FILE_CATEGORIES.IMAGES,
  'image/bmp': FILE_CATEGORIES.IMAGES,
  'image/tiff': FILE_CATEGORIES.IMAGES,
  'image/ico': FILE_CATEGORIES.IMAGES,

  // Videos
  'video/mp4': FILE_CATEGORIES.VIDEOS,
  'video/avi': FILE_CATEGORIES.VIDEOS,
  'video/mov': FILE_CATEGORIES.VIDEOS,
  'video/wmv': FILE_CATEGORIES.VIDEOS,
  'video/flv': FILE_CATEGORIES.VIDEOS,
  'video/webm': FILE_CATEGORIES.VIDEOS,
  'video/mkv': FILE_CATEGORIES.VIDEOS,
  'video/m4v': FILE_CATEGORIES.VIDEOS,

  // Audio
  'audio/mp3': FILE_CATEGORIES.AUDIO,
  'audio/wav': FILE_CATEGORIES.AUDIO,
  'audio/flac': FILE_CATEGORIES.AUDIO,
  'audio/aac': FILE_CATEGORIES.AUDIO,
  'audio/ogg': FILE_CATEGORIES.AUDIO,
  'audio/wma': FILE_CATEGORIES.AUDIO,
  'audio/m4a': FILE_CATEGORIES.AUDIO,

  // Spreadsheets
  'application/vnd.ms-excel': FILE_CATEGORIES.SPREADSHEETS,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FILE_CATEGORIES.SPREADSHEETS,
  'text/csv': FILE_CATEGORIES.SPREADSHEETS,
  'application/vnd.oasis.opendocument.spreadsheet': FILE_CATEGORIES.SPREADSHEETS,

  // Presentations
  'application/vnd.ms-powerpoint': FILE_CATEGORIES.PRESENTATIONS,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': FILE_CATEGORIES.PRESENTATIONS,
  'application/vnd.oasis.opendocument.presentation': FILE_CATEGORIES.PRESENTATIONS,

  // Archives
  'application/zip': FILE_CATEGORIES.ARCHIVES,
  'application/x-rar-compressed': FILE_CATEGORIES.ARCHIVES,
  'application/x-7z-compressed': FILE_CATEGORIES.ARCHIVES,
  'application/x-tar': FILE_CATEGORIES.ARCHIVES,
  'application/gzip': FILE_CATEGORIES.ARCHIVES,

  // Code
  'application/json': FILE_CATEGORIES.CODE,
  'application/javascript': FILE_CATEGORIES.CODE,
  'text/javascript': FILE_CATEGORIES.CODE,
  'text/html': FILE_CATEGORIES.CODE,
  'text/css': FILE_CATEGORIES.CODE,
  'application/xml': FILE_CATEGORIES.CODE,
  'text/xml': FILE_CATEGORIES.CODE,
  'application/yaml': FILE_CATEGORIES.CODE,
  'text/yaml': FILE_CATEGORIES.CODE
};

// File extension to category mapping (fallback)
export const EXTENSION_CATEGORIES = {
  // Documents
  pdf: FILE_CATEGORIES.DOCUMENTS,
  doc: FILE_CATEGORIES.DOCUMENTS,
  docx: FILE_CATEGORIES.DOCUMENTS,
  txt: FILE_CATEGORIES.DOCUMENTS,
  rtf: FILE_CATEGORIES.DOCUMENTS,
  md: FILE_CATEGORIES.DOCUMENTS,
  odt: FILE_CATEGORIES.DOCUMENTS,

  // Images
  jpg: FILE_CATEGORIES.IMAGES,
  jpeg: FILE_CATEGORIES.IMAGES,
  png: FILE_CATEGORIES.IMAGES,
  gif: FILE_CATEGORIES.IMAGES,
  webp: FILE_CATEGORIES.IMAGES,
  svg: FILE_CATEGORIES.IMAGES,
  bmp: FILE_CATEGORIES.IMAGES,
  tiff: FILE_CATEGORIES.IMAGES,
  ico: FILE_CATEGORIES.IMAGES,

  // Videos
  mp4: FILE_CATEGORIES.VIDEOS,
  avi: FILE_CATEGORIES.VIDEOS,
  mov: FILE_CATEGORIES.VIDEOS,
  wmv: FILE_CATEGORIES.VIDEOS,
  flv: FILE_CATEGORIES.VIDEOS,
  webm: FILE_CATEGORIES.VIDEOS,
  mkv: FILE_CATEGORIES.VIDEOS,
  m4v: FILE_CATEGORIES.VIDEOS,

  // Audio
  mp3: FILE_CATEGORIES.AUDIO,
  wav: FILE_CATEGORIES.AUDIO,
  flac: FILE_CATEGORIES.AUDIO,
  aac: FILE_CATEGORIES.AUDIO,
  ogg: FILE_CATEGORIES.AUDIO,
  wma: FILE_CATEGORIES.AUDIO,
  m4a: FILE_CATEGORIES.AUDIO,

  // Spreadsheets
  xls: FILE_CATEGORIES.SPREADSHEETS,
  xlsx: FILE_CATEGORIES.SPREADSHEETS,
  csv: FILE_CATEGORIES.SPREADSHEETS,
  ods: FILE_CATEGORIES.SPREADSHEETS,

  // Presentations
  ppt: FILE_CATEGORIES.PRESENTATIONS,
  pptx: FILE_CATEGORIES.PRESENTATIONS,
  odp: FILE_CATEGORIES.PRESENTATIONS,

  // Archives
  zip: FILE_CATEGORIES.ARCHIVES,
  rar: FILE_CATEGORIES.ARCHIVES,
  '7z': FILE_CATEGORIES.ARCHIVES,
  tar: FILE_CATEGORIES.ARCHIVES,
  gz: FILE_CATEGORIES.ARCHIVES,

  // Code
  json: FILE_CATEGORIES.CODE,
  js: FILE_CATEGORIES.CODE,
  jsx: FILE_CATEGORIES.CODE,
  ts: FILE_CATEGORIES.CODE,
  tsx: FILE_CATEGORIES.CODE,
  html: FILE_CATEGORIES.CODE,
  css: FILE_CATEGORIES.CODE,
  scss: FILE_CATEGORIES.CODE,
  xml: FILE_CATEGORIES.CODE,
  yaml: FILE_CATEGORIES.CODE,
  yml: FILE_CATEGORIES.CODE,
  py: FILE_CATEGORIES.CODE,
  java: FILE_CATEGORIES.CODE,
  cpp: FILE_CATEGORIES.CODE,
  c: FILE_CATEGORIES.CODE,
  php: FILE_CATEGORIES.CODE
};

/**
 * Automatically categorize a file based on its MIME type and extension
 * @param {string} mimeType - The file's MIME type
 * @param {string} extension - The file's extension (without dot)
 * @returns {Object} - The file category object
 */
export const categorizeFile = (mimeType, extension) => {
  // Try MIME type first (more reliable)
  if (mimeType && MIME_TYPE_CATEGORIES[mimeType]) {
    return MIME_TYPE_CATEGORIES[mimeType];
  }
  
  // Fallback to extension
  if (extension) {
    const ext = extension.toLowerCase().replace('.', '');
    if (EXTENSION_CATEGORIES[ext]) {
      return EXTENSION_CATEGORIES[ext];
    }
  }
  
  // Default to OTHER category
  return FILE_CATEGORIES.OTHER;
};

/**
 * Get file icon based on category
 * @param {Object} category - The file category object
 * @returns {string} - The icon emoji
 */
export const getCategoryIcon = (category) => {
  return category?.icon || FILE_CATEGORIES.OTHER.icon;
};

/**
 * Get file category color
 * @param {Object} category - The file category object
 * @returns {string} - The color hex code
 */
export const getCategoryColor = (category) => {
  // Returns a CSS value; consumers can apply directly to style props
  return category?.color || FILE_CATEGORIES.OTHER.color;
};

/**
 * Get all available categories as array
 * @returns {Array} - Array of category objects
 */
export const getAllCategories = () => {
  return Object.values(FILE_CATEGORIES);
};

/**
 * Get category by ID
 * @param {string} categoryId - The category ID
 * @returns {Object|null} - The category object or null if not found
 */
export const getCategoryById = (categoryId) => {
  return Object.values(FILE_CATEGORIES).find(cat => cat.id === categoryId) || null;
};

// Predefined automation-specific tags
export const AUTOMATION_TAGS = [
  'invoice',
  'receipt', 
  'contract',
  'form',
  'template',
  'report',
  'data',
  'automation',
  'workflow',
  'processed',
  'input',
  'output',
  'draft',
  'final',
  'review',
  'approved',
  'client',
  'internal'
];

/**
 * Validate and clean tags array
 * @param {Array} tags - Raw tags array
 * @returns {Array} - Cleaned and validated tags
 */
export const cleanTags = (tags = []) => {
  if (!Array.isArray(tags)) return [];
  
  return tags
    .map(tag => String(tag).trim().toLowerCase())
    .filter(tag => tag && tag.length > 0 && tag.length <= 50)
    .slice(0, 10); // Limit to 10 tags max
};

/**
 * Get suggested tags based on file category and name
 * @param {Object} category - The file category
 * @param {string} filename - The filename
 * @returns {Array} - Array of suggested tags
 */
export const getSuggestedTags = (category, filename = '') => {
  const suggestions = [];
  
  // Add category-based suggestions
  switch (category?.id) {
    case 'documents':
      suggestions.push('document', 'report', 'form');
      break;
    case 'images':
      suggestions.push('image', 'photo', 'screenshot');
      break;
    case 'videos':
      suggestions.push('video', 'recording', 'presentation');
      break;
    case 'spreadsheets':
      suggestions.push('data', 'report', 'analysis');
      break;
    case 'presentations':
      suggestions.push('presentation', 'slides', 'meeting');
      break;
    default:
      suggestions.push('file');
  }
  
  // Add filename-based suggestions
  const lowerName = filename.toLowerCase();
  if (lowerName.includes('invoice')) suggestions.push('invoice');
  if (lowerName.includes('receipt')) suggestions.push('receipt');
  if (lowerName.includes('contract')) suggestions.push('contract');
  if (lowerName.includes('template')) suggestions.push('template');
  if (lowerName.includes('draft')) suggestions.push('draft');
  if (lowerName.includes('final')) suggestions.push('final');
  
  return [...new Set(suggestions)]; // Remove duplicates
};