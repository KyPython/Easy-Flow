import express, { Router, Request, Response } from 'express';
import { body, validationResult, param } from 'express-validator';
import { TaskController } from '../controllers/TaskController';

const router: Router = express.Router();
const taskController = new TaskController();

// Validation rules
const taskValidationRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('status')
    .optional()
    .isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid status value'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('dueDate must be a valid ISO 8601 date'),
  body('hasMedia')
    .optional()
    .isBoolean()
    .withMessage('hasMedia must be a boolean'),
  body('altText')
    .optional()
    .custom((value, { req }) => {
      // Accessibility constraint: altText is required when hasMedia is true
      if (req.body.hasMedia === true && (!value || value.trim() === '')) {
        throw new Error('altText is required when hasMedia is true');
      }
      return true;
    })
    .isLength({ max: 500 })
    .withMessage('altText must be less than 500 characters'),
  body('labels')
    .optional()
    .isArray()
    .withMessage('labels must be an array'),
];

const idValidationRule = [
  param('id')
    .isUUID()
    .withMessage('Invalid task ID format'),
];

// Routes
router.get('/tasks', taskController.getAllTasks.bind(taskController));
router.get('/tasks/:id', idValidationRule, taskController.getTaskById.bind(taskController));
router.post('/tasks', taskValidationRules, taskController.createTask.bind(taskController));
router.put('/tasks/:id', [...idValidationRule, ...taskValidationRules], taskController.updateTask.bind(taskController));
router.delete('/tasks/:id', idValidationRule, taskController.deleteTask.bind(taskController));

export default router;

