import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

// Mock templates for demo purposes
const mockTemplates = [
  {
    id: 'template-1',
    name: 'Email Marketing Automation',
    description: 'Automated email sequences for lead nurturing, welcome series, and customer onboarding.',
    category: 'email_marketing',
    rating: 4.8,
    usage_count: 1250,
    author: 'KyJahn Smith',
    tags: ['email', 'marketing', 'automation'],
    estimated_time: '15 minutes',
    complexity: 'Medium',
    steps: 7,
    is_public: true,
    is_featured: true
  },
  {
    id: 'template-2',
    name: 'Web Data Scraping & Processing',
    description: 'Automatically scrape product data, prices, or content from websites.',
    category: 'web_automation',
    rating: 4.6,
    usage_count: 980,
    author: 'KyJahn Smith',
    tags: ['scraping', 'data', 'web'],
    estimated_time: '18 minutes',
    complexity: 'Medium',
    steps: 9,
    is_public: true,
    is_featured: true
  },
  {
    id: 'template-3',
    name: 'Web Scraping Automation',
    description: 'Extract data from websites automatically',
    category: 'web_automation',
    rating: 4.2,
    usage_count: 750,
    author: 'KyJahn Smith',
    tags: ['web', 'scraping', 'data'],
    estimated_time: '12 minutes',
    complexity: 'Easy',
    steps: 6,
    is_public: true,
    is_featured: false
  },
  {
    id: 'template-4',
    name: 'File Processing & Upload',
    description: 'Automatically process and organize uploaded files',
    category: 'file_management',
    rating: 4.4,
    usage_count: 650,
    author: 'KyJahn Smith',
    tags: ['file', 'upload', 'processing'],
    estimated_time: '10 minutes',
    complexity: 'Easy',
    steps: 5,
    is_public: true,
    is_featured: false
  },
  {
    id: 'template-5',
    name: 'API Integration Workflow',
    description: 'Connect and sync data between different services',
    category: 'api_integration',
    rating: 4.7,
    usage_count: 890,
    author: 'KyJahn Smith',
    tags: ['api', 'integration', 'sync'],
    estimated_time: '18 minutes',
    complexity: 'Medium',
    steps: 9,
    is_public: true,
    is_featured: true
  }
];

export const useWorkflowTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);

  // Load workflow templates
  const loadTemplates = useCallback(async (opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const {
        search = '',
        category = 'all',
        sortBy = 'popularity',
        page: p = page,
        pageSize: ps = pageSize
      } = opts;

      const from = (p - 1) * ps;
      const to = from + ps - 1;

      // Try ranked view first for popularity scoring; include search and filters
      let qry = supabase
        .from('workflow_templates_ranked')
        .select('*', { count: 'exact' })
        .order(sortBy === 'recent' ? 'updated_at' : (sortBy === 'name' ? 'name' : 'popularity_score'), { ascending: sortBy === 'name' })
        .range(from, to);

      if (category && category !== 'all') {
        qry = qry.eq('category', category);
      }
      if (search) {
        // name/description search (avoid tags.cs which can 400 if type mismatch)
        qry = qry.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      let { data, error: templatesError, count } = await qry;

      if (templatesError) {
        console.warn('[Templates] Ranked view query error:', {
          code: templatesError.code,
          message: templatesError.message,
          details: templatesError.details,
          hint: templatesError.hint
        });
      } else {
        console.debug('[Templates] Ranked view query ok:', {
          count,
          rows: Array.isArray(data) ? data.length : 0
        });
      }

      // If ranked view is missing or has schema issues, try a safer re-query, then fall back to base templates table
      if (templatesError && (templatesError.code === '42P01' || templatesError.code === '42703')) {
        // If it's an undefined column (likely popularity_score), try again ordering by updated_at
        if (templatesError.code === '42703') {
          try {
            let safeQry = supabase
              .from('workflow_templates_ranked')
              .select('*', { count: 'exact' })
              .order(sortBy === 'name' ? 'name' : 'updated_at', { ascending: sortBy === 'name' })
              .range(from, to);
            if (category && category !== 'all') safeQry = safeQry.eq('category', category);
            if (search) safeQry = safeQry.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
            const safeRes = await safeQry;
            if (!safeRes.error) {
              data = Array.isArray(safeRes.data) ? safeRes.data : [];
              count = typeof safeRes.count === 'number' ? safeRes.count : (Array.isArray(safeRes.data) ? safeRes.data.length : 0);
              // Use the successful re-query and skip deeper fallbacks
            } else {
              // Continue to base table fallback
              throw safeRes.error;
            }
          } catch (_reErr) {
            // proceed to base table fallback below
          }
        }
        // If data is still undefined from the safe retry, proceed with base table fallback
        if (!Array.isArray(data)) {
        try {
          let baseQry = supabase
            .from('workflow_templates')
            .select('*', { count: 'exact' })
            // Prefer sensible sort mapping when popularity_score is unavailable
            .order(
              sortBy === 'recent' ? 'updated_at' : (sortBy === 'name' ? 'name' : 'rating'),
              { ascending: sortBy === 'name' }
            )
            .range(from, to);

          // Only show public templates by default
          baseQry = baseQry.eq('is_public', true);

          if (category && category !== 'all') {
            baseQry = baseQry.eq('category', category);
          }
          if (search) {
            // Safe search across name/description; avoid relying on tags.cs which may not exist
            baseQry = baseQry.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
          }

          const baseRes = await baseQry;
          if (baseRes.error) {
            // If base table query still has schema/permission issues, fall back to public workflows
            if (baseRes.error.code === '42P01' || baseRes.error.code === '42703' || String(baseRes.error.message || '').toLowerCase().includes('permission')) {
              const { data: workflowData, error: workflowError } = await supabase
                .from('workflows')
                .select(`
                  id,
                  name,
                  description,
                  tags,
                  created_at,
                  updated_at,
                  total_executions,
                  successful_executions
                `)
                .eq('is_public', true)
                .eq('status', 'active')
                .order('total_executions', { ascending: false })
                .range(from, to);

              if (workflowError) throw workflowError;

              // Transform workflows to template-like format
              data = workflowData?.map(workflow => ({
                id: workflow.id,
                name: workflow.name,
                description: workflow.description || 'No description available',
                category: 'general',
                popularity: Math.min(100, Math.round((workflow.successful_executions / Math.max(1, workflow.total_executions)) * 100)),
                usage_count: workflow.total_executions || 0,
                created_at: workflow.created_at,
                updated_at: workflow.updated_at,
                author: 'EasyFlow Community',
                tags: workflow.tags || [],
                estimated_time: '10-15 minutes',
                complexity: workflow.total_executions > 50 ? 'Medium' : 'Easy',
                steps: 5,
                is_public: true,
                is_featured: workflow.total_executions > 100
              })) || [];
              count = data.length;
            } else {
              // Other errors bubble up to be handled by catch
              throw baseRes.error;
            }
          } else {
            data = Array.isArray(baseRes.data) ? baseRes.data : [];
            count = typeof baseRes.count === 'number' ? baseRes.count : (Array.isArray(baseRes.data) ? baseRes.data.length : 0);
          }
        } catch (fallbackErr) {
          // Re-throw to be handled by the outer catch, which may decide on mock fallback
          throw fallbackErr;
        }
        }
      } else if (templatesError) {
        throw templatesError;
      }

      // Ensure data is always an array and filter out any invalid entries
      data = Array.isArray(data) ? data.filter(template => 
        template && 
        typeof template === 'object' && 
        template.name && 
        template.id
      ) : [];

  // If no templates found, keep empty results; only use fallback on actual errors
  setTemplates(data);
  if (typeof count === 'number') setTotal(count);
  else setTotal(Array.isArray(data) ? data.length : 0);
  setPage(p);
  setPageSize(ps);
    } catch (err) {
      // Normalize error details for logging and UI
      const normalized = {
        code: err?.code,
        message: err?.message || String(err),
        details: err?.details,
        hint: err?.hint
      };
      console.error('Error loading templates:', normalized);
      setError(`${normalized.message}${normalized.code ? ` (code ${normalized.code})` : ''}`);
      // Provide fallback templates only if the schema is missing or access denied
      if (err?.code === '42P01' || err?.code === '42703' || String(err?.message || '').toLowerCase().includes('permission')) {
        setTemplates(mockTemplates);
        setTotal(mockTemplates.length);
      } else {
        setTemplates([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Create workflow from template
  const createFromTemplate = useCallback(async (templateId, workflowName) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Get template configuration (nodes and edges)
      let canvasConfig = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
      
      if (template.template_config) {
        // For database templates, use template_config
        canvasConfig = {
          ...canvasConfig,
          ...template.template_config
        };
      } else if (template.id.startsWith('template-')) {
        // For fallback templates, create a sample configuration
        canvasConfig = {
          nodes: [
            { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
            { id: 'end-1', type: 'end', position: { x: 100, y: 300 }, data: { label: 'End' } }
          ],
          edges: [
            { id: 'edge-1', source: 'start-1', target: 'end-1' }
          ],
          viewport: { x: 0, y: 0, zoom: 1 }
        };
      }

      // Get current user for RLS policy
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated to create workflows');
      }

      // Create new workflow based on template
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          user_id: user.id,
          name: workflowName || `${template.name} (Copy)`,
          description: template.description,
          tags: template.tags,
          status: 'draft',
          is_public: false,
          canvas_config: canvasConfig,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Telemetry: record install via RPC (increments usage_count)
      try {
        await supabase.rpc('record_template_install', { p_template_id: template.id });
      } catch (e) {
        console.warn('record_template_install RPC failed or unavailable:', e?.message || e);
      }

      return data;
    } catch (err) {
      console.error('Error creating workflow from template:', err);
      throw err;
    }
  }, [templates]);

  // Get template details
  const getTemplateDetails = useCallback(async (templateId) => {
    try {
      // Handle demo/mock template IDs (template-1, template-2, etc.)
      if (templateId.startsWith('template-')) {
        const mockTemplate = mockTemplates.find(t => t.id === templateId);
        if (mockTemplate) {
          return mockTemplate;
        }
        // If not found in mock templates, it might be an actual UUID with template- prefix
      }

      // If it's a workflow-based template, get workflow details
      if (templateId.startsWith('workflow-')) {
        const workflowId = templateId.replace('workflow-', '');
        const { data, error } = await supabase
          .from('workflows')
          .select(`
            *,
            workflow_steps(*),
            workflow_connections(*)
          `)
          .eq('id', workflowId)
          .single();

        if (error) throw error;
        return data;
      }

      // Validate UUID format before querying database
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(templateId)) {
        throw new Error(`Invalid template ID format: ${templateId}`);
      }

      // Otherwise get from templates table plus versions
      const { data: template, error: tErr } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (tErr) throw tErr;

      const { data: versions, error: vErr } = await supabase
        .from('template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false });
      if (vErr) throw vErr;

      return { ...template, versions };
    } catch (err) {
      console.error('Error loading template details:', err);
      throw err;
    }
  }, []);

  // Publish a template (owner flow): create template + version (pending_review)
  const publishTemplate = useCallback(async ({ name, description, category = 'general', tags = [], is_public = false, version = '1.0.0', changelog = '', config, dependencies = [], screenshots = [] }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be authenticated');

    // Insert template draft
    const { data: template, error: tErr } = await supabase
      .from('workflow_templates')
      .insert({
        owner_id: user.id,
        name,
        description,
        category,
        tags,
        is_public,
        status: 'pending_review',
        preview_images: screenshots
      })
      .select('*')
      .single();
    if (tErr) throw tErr;

    // Insert initial version
    const { data: ver, error: vErr } = await supabase
      .from('template_versions')
      .insert({
        template_id: template.id,
        version,
        changelog,
        config,
        dependencies,
        screenshots,
        submitted_by: user.id
      })
      .select('*')
      .single();
    if (vErr) throw vErr;

    // Set latest version pointer
    await supabase
      .from('workflow_templates')
      .update({ latest_version_id: ver.id })
      .eq('id', template.id);

    return { template, version: ver };
  }, []);

  // Rate a template (1-5 stars)
  const rateTemplate = useCallback(async (templateId, rating) => {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // In a real app, you'd track individual user ratings and calculate averages
      // For now, we'll update the rating directly (simplified approach)
      const { error } = await supabase
        .from('workflow_templates')
        .update({ 
          rating: rating,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (error) throw error;

      // Refresh templates to show updated rating
      await loadTemplates();
      
      return true;
    } catch (err) {
      console.error('Error rating template:', err);
      throw err;
    }
  }, [loadTemplates]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    loading,
    error,
  loadTemplates,
    createFromTemplate,
    getTemplateDetails,
    rateTemplate,
  publishTemplate,
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
  refreshTemplates: loadTemplates
  };
};