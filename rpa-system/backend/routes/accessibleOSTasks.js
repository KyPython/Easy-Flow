// AccessibleOS Task Management Routes - Merged from AccessibleOS
// This provides accessibility-first task management integrated with EasyFlow workflows

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');
const { createContextLogger } = require('../middleware/traceContext');

// Get all tasks for user
router.get('/', requireFeature('task_management'), async (req, res) => {
  const logger = createContextLogger({
    userId: req.user?.id,
    operation: 'get_tasks'
  });

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: tasks, error } = await supabase
      .from('accessibleos_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch tasks', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    res.json({
      success: true,
      data: tasks || []
    });
  } catch (error) {
    logger.error('Get tasks error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single task
router.get('/:id', requireFeature('task_management'), async (req, res) => {
  const logger = createContextLogger({
    userId: req.user?.id,
    taskId: req.params.id,
    operation: 'get_task'
  });

  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const supabase = getSupabase();
    const { data: task, error } = await supabase
      .from('accessibleos_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Get task error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task
router.post('/', requireFeature('task_management'), async (req, res) => {
  const logger = createContextLogger({
    userId: req.user?.id,
    operation: 'create_task'
  });

  try {
    const userId = req.user?.id;
    const { title, description, status, dueDate, altText, hasMedia, labels, automationId, workflowId } = req.body;

    const supabase = getSupabase();
    const { data: task, error } = await supabase
      .from('accessibleos_tasks')
      .insert({
        user_id: userId,
        title,
        description,
        status: status || 'PENDING',
        due_date: dueDate,
        alt_text: altText,
        has_media: hasMedia || false,
        labels: labels || [],
        automation_id: automationId,
        workflow_id: workflowId
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create task', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    logger.error('Create task error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', requireFeature('task_management'), async (req, res) => {
  const logger = createContextLogger({
    userId: req.user?.id,
    taskId: req.params.id,
    operation: 'update_task'
  });

  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const updateData = req.body;

    const supabase = getSupabase();
    const { data: task, error } = await supabase
      .from('accessibleos_tasks')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    logger.error('Update task error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', requireFeature('task_management'), async (req, res) => {
  const logger = createContextLogger({
    userId: req.user?.id,
    taskId: req.params.id,
    operation: 'delete_task'
  });

  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('accessibleos_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    logger.error('Delete task error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

