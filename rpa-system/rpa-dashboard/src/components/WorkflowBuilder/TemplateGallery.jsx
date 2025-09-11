import React, { useState, useMemo } from 'react';
import styles from './TemplateGallery.module.css';
import { 
  FaSearch, 
  FaFilter, 
  FaStar, 
  FaDownload, 
  FaEye, 
  FaTag,
  FaClock,
  FaUser,
  FaTh,
  FaList
} from 'react-icons/fa';
import { useWorkflowTemplates } from '../../hooks/useWorkflowTemplates';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';

// Helper moved top-level for reuse in preview modal
const formatTemplateCategory = (category) => {
  const categoryMap = {
    business_process: 'Business Process',
    data_processing: 'Data Processing',
    web_automation: 'Web Automation',
    email_marketing: 'Email Marketing',
    file_management: 'File Management',
    api_integration: 'API Integration',
    database_operations: 'Database Operations',
    report_generation: 'Report Generation',
    monitoring: 'Monitoring',
    general: 'General'
  };
  return categoryMap[category] || category || 'General';
};

const TemplateGallery = ({ onSelectTemplate, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // Use the templates hook
  const { 
    templates, 
    loading, 
    error, 
    createFromTemplate 
  } = useWorkflowTemplates();

  // Removed inner formatter, using top-level function

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'business_process', label: 'Business Process' },
    { value: 'data_processing', label: 'Data Processing' },
    { value: 'web_automation', label: 'Web Automation' },
    { value: 'email_marketing', label: 'Email Marketing' },
    { value: 'file_management', label: 'File Management' },
    { value: 'api_integration', label: 'API Integration' },
    { value: 'report_generation', label: 'Report Generation' },
    { value: 'monitoring', label: 'Monitoring' }
  ];

  const sortOptions = [
    { value: 'popularity', label: 'Most Popular' },
    { value: 'usage', label: 'Most Used' },
    { value: 'recent', label: 'Recently Updated' },
    { value: 'name', label: 'Name A-Z' }
  ];

  const filteredAndSortedTemplates = useMemo(() => {
    // Normalize template fields defensively
    const normalized = templates.map(t => ({
      ...t,
      // unify naming differences
      usageCount: t.usageCount ?? t.usage_count ?? 0,
      estimatedTime: t.estimatedTime ?? t.estimated_time ?? '—',
      createdAt: t.createdAt ?? t.created_at ?? t.updated_at ?? new Date().toISOString(),
      updatedAt: t.updatedAt ?? t.updated_at ?? t.created_at ?? new Date().toISOString(),
      tags: Array.isArray(t.tags) ? t.tags : []
    }));

    let filtered = normalized.filter(template => {
      const lQuery = searchQuery.toLowerCase();
      const matchesSearch = template.name.toLowerCase().includes(lQuery) ||
        (template.description || '').toLowerCase().includes(lQuery) ||
        template.tags.some(tag => tag.toLowerCase().includes(lQuery));
      
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.popularity - a.popularity;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'recent':
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, selectedCategory, sortBy]);

  const featuredTemplates = templates.filter(template => template.is_featured);

  if (loading) {
    return (
      <div className={styles.loadingState}>\n        <LoadingSpinner centered message="Loading templates..." />\n      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>\n        <h3>Templates</h3>\n        <p className={styles.errorText}>{error}</p>\n        <button onClick={() => window.location.reload()} className={styles.retryButton}>Retry</button>\n      </div>
    );
  }

  return (
    <div className={styles.templateGallery}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>Workflow Templates</h2>
          <p className={styles.subtitle}>Choose from pre-built templates to get started quickly</p>
        </div>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {/* Search and Filters */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.controlsRight}>
          <button
            className={`${styles.filterButton} ${showFilters ? styles.active : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> Filters
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <FaTh />
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              <FaList />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={styles.filtersPanel}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.filterSelect}
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Featured Templates */}
      {featuredTemplates.length > 0 && searchQuery === '' && selectedCategory === 'all' && (
        <div className={styles.featuredSection}>
          <h3 className={styles.sectionTitle}>
            <FaStar className={styles.sectionIcon} />
            Featured Templates
          </h3>
          <div className={styles.featuredGrid}>
            {featuredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelectTemplate}
                variant="featured"
              />
            ))}
          </div>
        </div>
      )}

      {/* All Templates */}
      <div className={styles.templatesSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            All Templates ({filteredAndSortedTemplates.length})
          </h3>
        </div>

        {filteredAndSortedTemplates.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <h4>No templates found</h4>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className={`${styles.templatesGrid} ${styles[viewMode]}`}>
            {filteredAndSortedTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelectTemplate}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TemplateCard = ({ template, onSelect, variant = 'normal', viewMode = 'grid' }) => {
  const [showPreview, setShowPreview] = useState(false);

  const getComplexityColor = (complexity) => {
    switch (complexity.toLowerCase()) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'neutral';
    }
  };

  if (viewMode === 'list') {
    return (
      <div className={`${styles.templateCard} ${styles.listView} ${variant === 'featured' ? styles.featured : ''}`}>
        <div className={styles.cardContent}>
          <div className={styles.cardLeft}>
            <img
              src={template.thumbnail}
              alt={template.name}
              className={styles.thumbnail}
            />
            <div className={styles.templateInfo}>
              <h4 className={styles.templateName}>{template.name}</h4>
              <p className={styles.templateDescription}>{template.description}</p>
              <div className={styles.templateMeta}>
                <span className={styles.metaItem}>
                  <FaUser /> {template.author}
                </span>
                <span className={styles.metaItem}>
                  <FaClock /> {template.estimatedTime}
                </span>
                <span className={styles.metaItem}>
                  <FaDownload /> {template.usageCount} uses
                </span>
              </div>
            </div>
          </div>
          <div className={styles.cardRight}>
            <div className={styles.templateStats}>
              <div className={`${styles.complexityBadge} ${styles[getComplexityColor(template.complexity)]}`}>
                {template.complexity}
              </div>
              <div className={styles.popularityScore}>
                <FaStar /> {template.popularity}%
              </div>
            </div>
            <div className={styles.cardActions}>
              <button
                className={styles.previewButton}
                onClick={() => setShowPreview(true)}
              >
                <FaEye /> Preview
              </button>
              <button
                className={styles.useButton}
                onClick={() => onSelect(template)}
              >
                Use Template
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.templateCard} ${variant === 'featured' ? styles.featured : ''}`}>
      <div className={styles.cardHeader}>
        <img
          src={template.thumbnail}
          alt={template.name}
          className={styles.thumbnail}
        />
        <div className={styles.cardOverlay}>
          <button
            className={styles.previewButton}
            onClick={() => setShowPreview(true)}
          >
            <FaEye /> Preview
          </button>
        </div>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.cardTop}>
          <h4 className={styles.templateName}>{template.name}</h4>
          <div className={styles.templateBadges}>
            <span className={styles.categoryBadge}>
              {formatTemplateCategory(template.category)}
            </span>
            <span className={`${styles.complexityBadge} ${styles[getComplexityColor(template.complexity)]}`}>
              {template.complexity}
            </span>
          </div>
        </div>

        <p className={styles.templateDescription}>{template.description}</p>

        <div className={styles.templateTags}>
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} className={styles.tag}>
              <FaTag /> {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className={styles.moreTagsIndicator}>
              +{template.tags.length - 3} more
            </span>
          )}
        </div>

        <div className={styles.templateStats}>
          <div className={styles.statItem}>
            <FaStar className={styles.statIcon} />
            <span>{template.popularity}%</span>
          </div>
          <div className={styles.statItem}>
            <FaDownload className={styles.statIcon} />
            <span>{template.usageCount}</span>
          </div>
          <div className={styles.statItem}>
            <FaClock className={styles.statIcon} />
            <span>{template.estimatedTime}</span>
          </div>
        </div>

        <div className={styles.templateMeta}>
          <span className={styles.author}>by {template.author}</span>
          <span className={styles.steps}>{template.steps} steps</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <button
          className={styles.useButton}
          onClick={() => onSelect(template)}
        >
          Use Template
        </button>
      </div>

      {/* Template Preview Modal */}
      {showPreview && (
        <TemplatePreviewModal
          template={template}
          onClose={() => setShowPreview(false)}
          onUse={() => {
            setShowPreview(false);
            onSelect(template);
          }}
        />
      )}
    </div>
  );
};

const TemplatePreviewModal = ({ template, onClose, onUse }) => {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.previewModal}>
        <div className={styles.modalHeader}>
          <h3>{template.name}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.previewImage}>
            <img src={template.thumbnail} alt={template.name} />
          </div>

          <div className={styles.previewDetails}>
            <p className={styles.previewDescription}>{template.description}</p>

            <div className={styles.previewMeta}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Category:</span>
                <span>{formatTemplateCategory(template.category)}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Complexity:</span>
                <span className={`${styles.complexityBadge} ${styles[template.complexity.toLowerCase()]}`}>
                  {template.complexity}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Estimated Time:</span>
                <span>{template.estimatedTime}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Steps:</span>
                <span>{template.steps}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Author:</span>
                <span>{template.author}</span>
              </div>
            </div>

            <div className={styles.previewTags}>
              <h4>Tags:</h4>
              <div className={styles.tagsList}>
                {template.tags.map(tag => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.useButton} onClick={onUse}>
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateGallery;