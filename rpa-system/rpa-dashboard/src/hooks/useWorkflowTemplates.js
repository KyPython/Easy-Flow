import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

export const useWorkflowTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load workflow templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load from workflow_templates table first
      let { data, error: templatesError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      // If templates table doesn't exist or has schema issues, fallback to public workflows
      if (templatesError && (templatesError.code === '42P01' || templatesError.code === '42703')) {
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
          .limit(20);

        if (workflowError) throw workflowError;

        // Transform workflows to template format
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
          thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
          steps: 5,
          is_public: true,
          is_featured: workflow.total_executions > 100
        })) || [];
      } else if (templatesError) {
        throw templatesError;
      }

      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err.message);
      // Provide fallback templates if database is not set up
      setTemplates([
        {
          id: 'template-1',
          name: 'Email Automation Workflow',
          description: 'Automatically send personalized emails based on user actions',
          category: 'email_marketing',
          popularity: 95,
          usage_count: 1250,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          author: 'EasyFlow Team',
          tags: ['email', 'automation', 'marketing'],
          estimated_time: '15 minutes',
          complexity: 'Medium',
          thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop',
          steps: 8,
          is_public: true,
          is_featured: true
        },
        {
          id: 'template-2',
          name: 'Data Processing Pipeline',
          description: 'Process and transform data from multiple sources',
          category: 'data_processing',
          popularity: 87,
          usage_count: 892,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          author: 'EasyFlow Team',
          tags: ['data', 'processing', 'automation'],
          estimated_time: '20 minutes',
          complexity: 'Medium',
          thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
          steps: 12,
          is_public: true,
          is_featured: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create workflow from template
  const createFromTemplate = async (templateId, workflowName) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Create new workflow based on template
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name: workflowName || `${template.name} (Copy)`,
          description: template.description,
          tags: template.tags,
          status: 'draft',
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error creating workflow from template:', err);
      throw err;
    }
  };

  // Get template details
  const getTemplateDetails = async (templateId) => {
    try {
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

      // Otherwise get from templates table
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error loading template details:', err);
      throw err;
    }
  };

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
    refreshTemplates: loadTemplates
  };
};