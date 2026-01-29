import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusBadge from './StatusBadge';

// Mock the formatters utility
jest.mock('../../utils/formatters', () => ({
  formatTaskStatus: (status) => {
    const statusMap = {
      'pending': 'Pending',
      'queued': 'Queued',
      'running': 'Running',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'failed': 'Failed'
    };
    return statusMap[status] || status;
  }
}));

describe('StatusBadge Component', () => {
  describe('Status Types', () => {
    test('renders completed status', () => {
      render(<StatusBadge status="completed" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    test('completed status has success styling', () => {
      const { container } = render(<StatusBadge status="completed" />);
      const badge = container.querySelector('span');
      expect(badge.className).toMatch(/success/);
    });

    test('renders failed status', () => {
      render(<StatusBadge status="failed" />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    test('failed status has error styling', () => {
      const { container } = render(<StatusBadge status="failed" />);
      const badge = container.querySelector('span');
      expect(badge.className).toMatch(/error/);
    });

    test('renders running status', () => {
      render(<StatusBadge status="running" />);
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    test('running status has warning styling', () => {
      const { container } = render(<StatusBadge status="running" />);
      const badge = container.querySelector('span');
      expect(badge.className).toMatch(/warning/);
    });

    test('renders in_progress status', () => {
      render(<StatusBadge status="in_progress" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    test('renders queued status', () => {
      render(<StatusBadge status="queued" />);
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });

    test('queued status has neutral styling', () => {
      const { container } = render(<StatusBadge status="queued" />);
      const badge = container.querySelector('span');
      expect(badge.className).toMatch(/neutral/);
    });

    test('renders pending status', () => {
      render(<StatusBadge status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('handles unknown status gracefully', () => {
      render(<StatusBadge status="unknown_status" />);
      expect(screen.getByText('unknown_status')).toBeInTheDocument();
    });

    test('unknown status has neutral styling', () => {
      const { container } = render(<StatusBadge status="unknown_status" />);
      const badge = container.querySelector('span');
      expect(badge.className).toMatch(/neutral/);
    });
  });

  describe('Badge Structure', () => {
    test('badge has badge class', () => {
      const { container } = render(<StatusBadge status="completed" />);
      const badge = container.querySelector('span');
      expect(badge.className).toMatch(/badge/);
    });

    test('badge renders as span element', () => {
      const { container } = render(<StatusBadge status="completed" />);
      const badge = container.querySelector('span');
      expect(badge).toBeInTheDocument();
    });
  });
});
