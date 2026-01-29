import { useState, useEffect, useCallback } from 'react';
import supabase, { initSupabase } from '../utils/supabaseClient';
import { useKeysetPagination } from './useKeysetPagination';
export const useWorkflowTemplatesKeyset = () => {
 const [templates, setTemplates] = useState([]);
 const [error, setError] = useState(null);
 const [filters, setFilters] = useState({
 search: '',
 category: 'all',
 sortBy: 'popularity'
 });

 const {
 currentPage,
 hasNextPage,
 hasPrevPage,
 loading,
 total,
 paginationInfo,
 nextPage,
 prevPage,
 reset: resetPagination,
 setLoading,
 updatePaginationState,
 getCurrentCursor,
 buildCursorQuery
 } = useKeysetPagination({
 pageSize: 24,
 initialSort: 'updated_at',
 sortDirection: 'desc'
 });

 // Build Supabase query with cursor-based pagination
 const buildQuery = useCallback((cursor = null, client) => {
 const { search, category, sortBy } = filters;
 
 const db = client || supabase;
 // Start with base query - try ranked view first
 let query = db.from('workflow_templates_ranked').select('*');

 // Apply filters
 if (category && category !== 'all') {
 query = query.eq('category', category);
 }

 if (search) {
 query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`);
 }

 // Apply cursor-based pagination
 if (cursor) {
 const { field, operator, value, id } = cursor;
 
 // Use composite cursor for better consistency
 if (field === 'updated_at') {
 if (operator === 'lt') {
 query = query.or(`updated_at.lt.${value},and(updated_at.eq.${value},id.lt.${id})`);
 } else {
 query = query.or(`updated_at.gt.${value},and(updated_at.eq.${value},id.gt.${id})`);
 }
 } else if (field === 'popularity_score') {
 if (operator === 'lt') {
 query = query.or(`popularity_score.lt.${value},and(popularity_score.eq.${value},updated_at.lt.${value},id.lt.${id})`);
 } else {
 query = query.or(`popularity_score.gt.${value},and(popularity_score.eq.${value},updated_at.gt.${value},id.gt.${id})`);
 }
 } else if (field === 'name') {
 if (operator === 'lt') {
 query = query.or(`name.lt.${value},and(name.eq.${value},id.lt.${id})`);
 } else {
 query = query.or(`name.gt.${value},and(name.eq.${value},id.gt.${id})`);
 }
 }
 // Apply ordering based on sortBy
 const sortField = sortBy === 'recent' ? 'updated_at' : 
 sortBy === 'name' ? 'name' : 'popularity_score';
 const ascending = sortBy === 'name';
 
 query = query.order(sortField, { ascending });
 
 // Add secondary sort for consistency
 if (sortField !== 'updated_at') {
 query = query.order('updated_at', { ascending: false });
 }
 query = query.order('id', { ascending });

 // Limit results (fetch one extra to check if there's a next page)
 query = query.limit(25);

 return query;
 }, [filters]);

 // Load workflow templates with keyset pagination
 const loadTemplates = useCallback(async (resetResults = false) => {
 try {
 setLoading(true);
 setError(null);

 if (resetResults) {
 resetPagination();
 setTemplates([]);
 }

 const cursor = resetResults ? null : getCurrentCursor();
 const cursorQuery = cursor ? buildCursorQuery(cursor) : {};
 
 const client = await initSupabase();
 let query = buildQuery(cursorQuery.cursor, client);

 const { data, error: templatesError } = await query;

 // If ranked view doesn't exist, fallback to regular workflows
 if (templatesError && (templatesError.code === '42P01' || templatesError.code === '42703')) {
 const fallbackQuery = client
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
 import { useState, useEffect, useCallback } from 'react';
 import supabase, { initSupabase } from '../utils/supabaseClient';
 import { useKeysetPagination } from './useKeysetPagination';

 export const useWorkflowTemplatesKeyset = () => {
 const [templates, setTemplates] = useState([]);
 const [error, setError] = useState(null);
 const [filters, setFilters] = useState({
 search: '',
 category: 'all',
 sortBy: 'popularity'
 });

 const {
 currentPage,
 hasNextPage,
 hasPrevPage,
 loading,
 total,
 paginationInfo,
 nextPage,
 prevPage,
 reset: resetPagination,
 setLoading,
 updatePaginationState,
 getCurrentCursor,
 buildCursorQuery
 } = useKeysetPagination({
 pageSize: 24,
 initialSort: 'updated_at',
 sortDirection: 'desc'
 });

 // Build Supabase query with cursor-based pagination
 // Accepts optional concrete client so we don't call the stub during build
 const buildQuery = useCallback((cursor = null, client) => {
 const { search, category, sortBy } = filters;
 const db = client || supabase;

 // Start with base query - try ranked view first
 let query = db.from('workflow_templates_ranked').select('*');

 // Apply filters
 if (category && category !== 'all') {
 query = query.eq('category', category);
 }

 if (search) {
 query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`);
 }

 // Apply cursor-based pagination
 if (cursor) {
 const { field, operator, value, id } = cursor;

 // Use composite cursor for better consistency
 if (field === 'updated_at') {
 if (operator === 'lt') {
 query = query.or(`updated_at.lt.${value},and(updated_at.eq.${value},id.lt.${id})`);
 } else {
 query = query.or(`updated_at.gt.${value},and(updated_at.eq.${value},id.gt.${id})`);
 }
 } else if (field === 'popularity_score') {
 if (operator === 'lt') {
 query = query.or(`popularity_score.lt.${value},and(popularity_score.eq.${value},updated_at.lt.${value},id.lt.${id})`);
 } else {
 query = query.or(`popularity_score.gt.${value},and(popularity_score.eq.${value},updated_at.gt.${value},id.gt.${id})`);
 }
 } else if (field === 'name') {
 if (operator === 'lt') {
 query = query.or(`name.lt.${value},and(name.eq.${value},id.lt.${id})`);
 } else {
 query = query.or(`name.gt.${value},and(name.eq.${value},id.gt.${id})`);
 }
 }
 }

 // Apply ordering based on sortBy
 const sortField = sortBy === 'recent' ? 'updated_at' : 
 sortBy === 'name' ? 'name' : 'popularity_score';
 const ascending = sortBy === 'name';
 
 query = query.order(sortField, { ascending });
 
 // Add secondary sort for consistency
 if (sortField !== 'updated_at') {
 query = query.order('updated_at', { ascending: false });
 }
 query = query.order('id', { ascending: true });

 // Limit results (fetch one extra to check if there's a next page)
 query = query.limit(25);

 return query;
 }, [filters]);

 // Load workflow templates with keyset pagination
 const loadTemplates = useCallback(async (resetResults = false) => {
 try {
 setLoading(true);
 setError(null);

 if (resetResults) {
 resetPagination();
 setTemplates([]);
 }

 const cursor = resetResults ? null : getCurrentCursor();
 const cursorQuery = cursor ? buildCursorQuery(cursor) : {};
 
 // Ensure concrete client before executing queries
 const client = await initSupabase();
 let query = buildQuery(cursorQuery.cursor, client);

 const { data, error: templatesError } = await query;

 // If ranked view doesn't exist, fallback to regular workflows
 if (templatesError && (templatesError.code === '42P01' || templatesError.code === '42703')) {
 const fallbackQuery = client
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
 .limit(25);

 if (cursor) {
 const { field, value } = cursor;
 if (field === 'updated_at') {
 fallbackQuery.lt('updated_at', value);
 }
 }

 const { data: workflowData, error: workflowError } = await fallbackQuery;
 
 if (workflowError) throw workflowError;

 // Transform workflows to template format
 const transformedData = workflowData?.map(workflow => ({
 id: workflow.id,
 name: workflow.name,
 description: workflow.description || 'No description available',
 category: 'general',
 popularity_score: Math.min(100, Math.round((workflow.successful_executions / Math.max(1, workflow.total_executions)) * 100)),
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

 const hasMore = transformedData.length === 25;
 const displayData = hasMore ? transformedData.slice(0, 24) : transformedData;

 setTemplates(prev => resetResults ? displayData : [...prev, ...displayData]);
 updatePaginationState(displayData, displayData.length);
 
 return;
 } else if (templatesError) {
 throw templatesError;
 }

 // Process successful template data
 const processedData = Array.isArray(data) ? data.filter(template => 
 template && 
 typeof template === 'object' && 
 template.name && 
 template.id
 ) : [];

 // Check if we have more pages (we fetched 25 but only show 24)
 const hasMore = processedData.length === 25;
 const displayData = hasMore ? processedData.slice(0, 24) : processedData;

 setTemplates(prev => resetResults ? displayData : [...prev, ...displayData]);
 updatePaginationState(displayData, displayData.length);

 // If no templates found on first page, show fallback
 if (displayData.length === 0 && currentPage === 1) {
 setTemplates([
 {
 id: 'template-1',
 name: 'Email Marketing Automation',
 description: 'Automated email sequences for lead nurturing, welcome series, and customer onboarding. Triggers emails based on user actions and engagement.',
 category: 'email_marketing',
 popularity_score: 95,
 usage_count: 1250,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 author: 'KyJahn Smith',
 tags: ['email', 'marketing', 'automation', 'nurturing', 'leads'],
 estimated_time: '15 minutes',
 complexity: 'Medium',
 steps: 7,
 is_public: true,
 is_featured: true
 },
 {
 id: 'template-2',
 name: 'Web Data Scraping & Processing',
 description: 'Automatically scrape product data, prices, or content from websites. Includes data cleaning, transformation, and storage.',
 category: 'web_automation',
 popularity_score: 87,
 usage_count: 892,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 author: 'KyJahn Smith',
 tags: ['scraping', 'data', 'web', 'extraction', 'monitoring'],
 estimated_time: '18 minutes',
 complexity: 'Medium',
 steps: 9,
 is_public: true,
 is_featured: true
 }
 ]);
 }

 } catch (err) {
 logger.error('Error loading templates:', err);
 setError(err.message);
 
 // Provide fallback templates on error
 if (currentPage === 1) {
 setTemplates([
 {
 id: 'template-error-1',
 name: 'Sample Workflow Template',
 description: 'A sample workflow template to get you started',
 category: 'general',
 popularity_score: 75,
 usage_count: 100,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 author: 'EasyFlow Team',
 tags: ['sample', 'starter'],
 estimated_time: '10 minutes',
 complexity: 'Easy',
 steps: 3,
 is_public: true,
 is_featured: false
 }
 ]);
 }
 } finally {
 setLoading(false);
 }
 }, [buildQuery, getCurrentCursor, buildCursorQuery, setLoading, resetPagination, updatePaginationState, currentPage]);

 // Update filters and reload
 const updateFilters = useCallback((newFilters) => {
 setFilters(prev => ({ ...prev, ...newFilters }));
 resetPagination();
 }, [resetPagination]);

 // Create workflow from template
 const createFromTemplate = useCallback(async (templateId, workflowName) => {
 try {
 const template = templates.find(t => t.id === templateId);
 if (!template) {
 throw new Error('Template not found');
 }

 const client = await initSupabase();
 const { data: { user } } = await client.auth.getUser();
 if (!user) {
 throw new Error('User must be authenticated to create workflows');
 }

 // Generate basic canvas config
 const canvasConfig = {
 nodes: [
 { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
 { id: 'end-1', type: 'end', position: { x: 100, y: 300 }, data: { label: 'End' } }
 ],
 edges: [
 { id: 'edge-1', source: 'start-1', target: 'end-1' }
 ],
 viewport: { x: 0, y: 0, zoom: 1 }
 };

 const { data, error } = await client
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

 // Record template usage
 try {
 await client.rpc('record_template_install', { p_template_id: template.id });
 } catch (e) {
 logger.warn('record_template_install RPC failed:', e?.message);
 }

 return data;
 } catch (err) {
 logger.error('Error creating workflow from template:', err);
 throw err;
 }
 }, [templates]);

 // Load initial templates
 useEffect(() => {
 loadTemplates(true);
 }, [filters]);

 return {
 templates,
 loading,
 error,
 
 // Pagination
 ...paginationInfo,
 nextPage,
 prevPage,
 
 // Actions
 loadTemplates,
 updateFilters,
 createFromTemplate,
 
 // Filters
 filters,
 
 // Legacy compatibility
 page: currentPage,
 pageSize: 24,
 setPage: () => {}, // Not used in keyset pagination
 setPageSize: () => {} // Not used in keyset pagination
 };
 };
