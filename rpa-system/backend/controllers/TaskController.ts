import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TaskController {
  /**
   * Get all tasks
   * GET /api/tasks
   */
  async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json({ data: tasks });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks', message: (error as Error).message });
    }
  }

  /**
   * Get task by ID
   * GET /api/tasks/:id
   */
  async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const task = await prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({ data: task });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task', message: (error as Error).message });
    }
  }

  /**
   * Create a new task
   * POST /api/tasks
   */
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { title, description, status, dueDate, altText, hasMedia, labels } = req.body;

      // Additional accessibility validation
      if (hasMedia === true && (!altText || altText.trim() === '')) {
        res.status(400).json({ 
          error: 'Accessibility violation',
          message: 'altText is required when hasMedia is true' 
        });
        return;
      }

      const task = await prisma.task.create({
        data: {
          title,
          description: description || null,
          status: status || 'PENDING',
          dueDate: dueDate ? new Date(dueDate) : null,
          altText: altText || null,
          hasMedia: hasMedia || false,
          labels: labels || [],
        },
      });

      res.status(201).json({ data: task });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create task', message: (error as Error).message });
    }
  }

  /**
   * Update a task
   * PUT /api/tasks/:id
   */
  async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { title, description, status, dueDate, altText, hasMedia, labels } = req.body;

      // Check if task exists
      const existingTask = await prisma.task.findUnique({
        where: { id },
      });

      if (!existingTask) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Accessibility validation
      const updatedHasMedia = hasMedia !== undefined ? hasMedia : existingTask.hasMedia;
      const updatedAltText = altText !== undefined ? altText : existingTask.altText;

      if (updatedHasMedia === true && (!updatedAltText || updatedAltText.trim() === '')) {
        res.status(400).json({ 
          error: 'Accessibility violation',
          message: 'altText is required when hasMedia is true' 
        });
        return;
      }

      const task = await prisma.task.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description: description || null }),
          ...(status && { status }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(altText !== undefined && { altText: altText || null }),
          ...(hasMedia !== undefined && { hasMedia }),
          ...(labels !== undefined && { labels }),
        },
      });

      res.json({ data: task });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update task', message: (error as Error).message });
    }
  }

  /**
   * Delete a task
   * DELETE /api/tasks/:id
   */
  async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      await prisma.task.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete task', message: (error as Error).message });
    }
  }
}

