import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './TemplateGallery.module.css';
import { 
  FaSearch, 
  FaFilter, 
  FaStar, 
  FaDownload, 
  FaTag,
  FaClock,
  FaUser,
  FaTh,
  FaList
} from 'react-icons/fa';
import { useWorkflowTemplates } from '../../hooks/useWorkflowTemplates';
import { useTheme } from '../../utils/ThemeContext';
import { createLogger } from '../../utils/logger';
import LoadingSpinner from './LoadingSpinner';
import TemplateDetails from './TemplateDetails';
import VirtualizedGrid from '../VirtualizedGrid/VirtualizedGrid';
import { SkeletonGrid, SkeletonList } from '../Skeleton/Skeleton';
import LazyImage from '../LazyImage/LazyImage';

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
  const { theme } = useTheme() || { theme: 'light' };
  const logger = createLogger('TemplateGallery'); // Structured logger for observability
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
  createFromTemplate,
  loadTemplates,
  page,
  pageSize,
  total,
  setPage,
  setPageSize
  } = useWorkflowTemplates();

  const [selected, setSelected] = useState(null);

  const handleTemplateSelection = async (template) => {
    try {
      logger.info('Creating workflow from template', { template_id: template.id, template_name: template.name });
      
      // Generate a workflow name based on the template
      const workflowName = `${template.name} - ${new Date().toLocaleDateString()}`;
      
      // Create the workflow from template
      const newWorkflow = await createFromTemplate(template.id, workflowName);
      
      logger.info('Workflow created successfully from template', { workflow_id: newWorkflow?.id, template_id: template.id });
      
      // Pass the created workflow back to parent
      onSelectTemplate(newWorkflow);
      
    } catch (error) {
      logger.error('Failed to create workflow from template', { 
        error: error.message, 
        stack: error.stack,
        template_id: template?.id,
        template_name: template?.name
      });
      alert('Failed to create workflow from template: ' + error.message);
    }
  };

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

  // ✅ INDUSTRY-SPECIFIC TEMPLATES: Add industry filter
  const industries = [
    { value: 'all', label: 'All Industries' },
    { value: 'freelancer', label: 'Freelancer' },
    { value: 'agency', label: 'Agency' },
    { value: 'home_services', label: 'Home Services' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'saas', label: 'SaaS' },
    { value: 'consulting', label: 'Consulting' }
  ];

  const [selectedIndustry, setSelectedIndustry] = useState('all');

  const sortOptions = [
    { value: 'popularity', label: 'Most Popular' },
    { value: 'usage', label: 'Most Used' },
    { value: 'recent', label: 'Recently Updated' },
    { value: 'name', label: 'Name A-Z' }
  ];

  // Server-driven list: rely on hook for search/category/sort/pagination
  const normalizedTemplates = (templates || []).map(t => ({
    ...t,
    name: t.name || 'Untitled Template',
    description: t.description || 'No description available',
    category: t.category || 'general',
    complexity: t.complexity || 'Easy',
    author: t.author || (t.created_by ? 'KyJahn Smith' : 'Unknown'),
    usageCount: t.usageCount ?? t.usage_count ?? 0,
    estimatedTime: t.estimatedTime ?? t.estimated_time ?? '—',
    createdAt: t.createdAt ?? t.created_at ?? t.updated_at ?? new Date().toISOString(),
    updatedAt: t.updatedAt ?? t.updated_at ?? t.created_at ?? new Date().toISOString(),
    tags: Array.isArray(t.tags) ? t.tags.filter(tag => tag && typeof tag === 'string') : [],
    popularity: t.popularity ?? (t.rating > 0 ? Math.round(t.rating * 20) : 0),
    steps: t.steps ?? (t.template_config?.nodes?.length || 0)
  }));

  const filteredAndSortedTemplates = normalizedTemplates;

  // Load from server whenever filters change
  useEffect(() => {
    setPage(1); // reset page when filters change
  }, [searchQuery, selectedCategory, selectedIndustry, sortBy]);

  useEffect(() => {
    loadTemplates({
      search: searchQuery,
      category: selectedCategory,
      industry: selectedIndustry, // ✅ NEW: Pass industry filter
      sortBy,
      page,
      pageSize
    });
  }, [searchQuery, selectedCategory, selectedIndustry, sortBy, page, pageSize, loadTemplates]);

  const featuredTemplates = templates.filter(template => template.is_featured);

  if (loading && filteredAndSortedTemplates.length === 0) {
    return (
      <div className={styles.loadingState} data-theme={theme}>
        {viewMode === 'grid' ? <SkeletonGrid count={6} /> : <SkeletonList count={5} />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState} data-theme={theme}>
        <h3>Templates</h3>
        <p className={styles.errorText}>{error}</p>
        <button onClick={() => window.location.reload()} className={styles.retryButton}>Retry</button>
      </div>
    );
  }

  if (selected) {
    return (
      <div data-theme={theme}>
        <TemplateDetails
          templateId={selected}
          onBack={() => setSelected(null)}
          onUse={(wf) => onSelectTemplate(wf)}
        />
      </div>
    );
  }

  return (
    <div className={styles.templateGallery} data-theme={theme}>
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

      {/* Scrollable body */}
      <div className={styles.galleryBody}>
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
            
            {/* ✅ NEW: Industry Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Industry</label>
              <select
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className={styles.filterSelect}
              >
                {industries.map(industry => (
                  <option key={industry.value} value={industry.value}>
                    {industry.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Featured Templates */}
        {featuredTemplates.length > 0 && searchQuery === '' && selectedCategory === 'all' && selectedIndustry === 'all' && (
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
                  onSelect={(t) => setSelected(t.id)}
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
              All Templates ({typeof total === 'number' ? total : filteredAndSortedTemplates.length})
            </h3>
          </div>

          {filteredAndSortedTemplates.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h4>No templates found</h4>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              <div className={`${styles.templatesGrid} ${styles[viewMode]}`}>
                {filteredAndSortedTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={(t) => setSelected(t.id)}
                    viewMode={viewMode}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              <div className={styles.pagination}>
                <div className={styles.pageInfo}>
                  Page {page} {typeof total === 'number' && total >= 0 && pageSize > 0 ? `of ${Math.max(1, Math.ceil(total / pageSize))}` : ''}
                </div>
                <div className={styles.pageControls}>
                  <button
                    className={styles.pageButton}
                    disabled={page <= 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <button
                    className={styles.pageButton}
                    disabled={typeof total === 'number' ? page >= Math.ceil(total / pageSize) : filteredAndSortedTemplates.length < pageSize}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                  <select
                    className={styles.pageSizeSelect}
                    value={pageSize}
                    onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 24)}
                  >
                    {[12, 24, 48, 96].map(sz => (
                      <option key={sz} value={sz}>{sz} / page</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TemplateCard = ({ template, onSelect, variant = 'normal', viewMode = 'grid' }) => {
  const getComplexityColor = (complexity) => {
    switch ((complexity || '').toLowerCase()) {
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
                  <FaDownload /> {template.usageCount > 0 ? `${template.usageCount} uses` : 'No uses yet'}
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

    </div>
  );
};


TemplateGallery.propTypes = {
  onSelectTemplate: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

TemplateCard.propTypes = {
  template: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    author: PropTypes.string,
    estimatedTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    usageCount: PropTypes.number,
    complexity: PropTypes.string,
    popularity: PropTypes.number,
    category: PropTypes.string,
    steps: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    tags: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['normal', 'featured']),
  viewMode: PropTypes.oneOf(['grid', 'list'])
};


export default TemplateGallery;