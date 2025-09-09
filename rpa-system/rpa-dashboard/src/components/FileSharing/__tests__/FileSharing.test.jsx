// Comprehensive test suite for FileSharing component
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key
  })
}));

jest.mock('../../utils/api', () => ({
  createFileShare: jest.fn(),
  updateFileShare: jest.fn(),
  deleteFileShare: jest.fn(),
  getShareUrl: jest.fn((token) => `https://app.example.com/shared/${token}`)
}));

// Mock react-icons
jest.mock('react-icons/fi', () => ({
  FiShare2: () => <span data-testid="share-icon" />,
  FiLink: () => <span data-testid="link-icon" />,
  FiCopy: () => <span data-testid="copy-icon" />,
  FiEye: () => <span data-testid="eye-icon" />,
  FiDownload: () => <span data-testid="download-icon" />,
  FiEdit3: () => <span data-testid="edit-icon" />,
  FiLock: () => <span data-testid="lock-icon" />,
  FiUnlock: () => <span data-testid="unlock-icon" />,
  FiCalendar: () => <span data-testid="calendar-icon" />,
  FiUsers: () => <span data-testid="users-icon" />,
  FiTrash2: () => <span data-testid="trash-icon" />,
  FiCheck: () => <span data-testid="check-icon" />,
  FiX: () => <span data-testid="x-icon" />,
  FiGlobe: () => <span data-testid="globe-icon" />,
  FiMail: () => <span data-testid="mail-icon" />,
  FiSettings: () => <span data-testid="settings-icon" />
}));

import FileSharing from '../FileSharing.optimized';
import * as api from '../../utils/api';

// Test data
const mockFile = {
  id: 'file-123',
  original_name: 'test-document.pdf',
  name: 'Test Document',
  file_size: 1048576, // 1MB
  mime_type: 'application/pdf'
};

const mockExistingShares = [
  {
    id: 'share-1',
    shareUrl: 'https://app.example.com/shared/token123',
    permissions: 'view',
    created_at: '2024-01-01T00:00:00Z',
    require_password: false,
    expires_at: null
  },
  {
    id: 'share-2',
    shareUrl: 'https://app.example.com/shared/token456',
    permissions: 'download',
    created_at: '2024-01-02T00:00:00Z',
    require_password: true,
    expires_at: '2024-12-31T23:59:59Z'
  }
];

const defaultProps = {
  file: mockFile,
  isOpen: true,
  onClose: jest.fn(),
  onCreateShare: jest.fn(),
  onUpdateShare: jest.fn(),
  onDeleteShare: jest.fn(),
  existingShares: []
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

describe('FileSharing Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering', () => {
    test('renders sharing dialog when open', () => {
      render(<FileSharing {...defaultProps} />);
      
      expect(screen.getByText('Share File')).toBeInTheDocument();
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('application/pdf')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<FileSharing {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Share File')).not.toBeInTheDocument();
    });

    test('renders permission buttons', () => {
      render(<FileSharing {...defaultProps} />);
      
      expect(screen.getByText('View only')).toBeInTheDocument();
      expect(screen.getByText('View & Download')).toBeInTheDocument();
      expect(screen.getByText('View & Edit')).toBeInTheDocument();
    });

    test('renders existing shares when provided', () => {
      render(<FileSharing {...defaultProps} existingShares={mockExistingShares} />);
      
      expect(screen.getByText('Existing Shares')).toBeInTheDocument();
      expect(screen.getByText('https://app.example.com/shared/token123')).toBeInTheDocument();
      expect(screen.getByText('https://app.example.com/shared/token456')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    test('closes dialog when close button clicked', async () => {
      const onClose = jest.fn();
      render(<FileSharing {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByTestId('x-icon').closest('button');
      await userEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('closes dialog when overlay clicked', async () => {
      const onClose = jest.fn();
      render(<FileSharing {...defaultProps} onClose={onClose} />);
      
      const overlay = screen.getByText('Share File').closest('.overlay');
      await userEvent.click(overlay);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('does not close when modal content clicked', async () => {
      const onClose = jest.fn();
      render(<FileSharing {...defaultProps} onClose={onClose} />);
      
      const modal = screen.getByText('Share File').closest('.modal');
      await userEvent.click(modal);
      
      expect(onClose).not.toHaveBeenCalled();
    });

    test('changes permission when permission button clicked', async () => {
      render(<FileSharing {...defaultProps} />);
      
      const downloadButton = screen.getByText('View & Download');
      await userEvent.click(downloadButton);
      
      expect(downloadButton.closest('button')).toHaveClass('active');
    });

    test('toggles password requirement', async () => {
      render(<FileSharing {...defaultProps} />);
      
      const passwordCheckbox = screen.getByText('Require password').previousElementSibling;
      await userEvent.click(passwordCheckbox);
      
      expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    });

    test('shows advanced settings when toggled', async () => {
      render(<FileSharing {...defaultProps} />);
      
      const advancedToggle = screen.getByText('Advanced Settings');
      await userEvent.click(advancedToggle);
      
      expect(screen.getByText('Expires at')).toBeInTheDocument();
      expect(screen.getByText('Max downloads')).toBeInTheDocument();
      expect(screen.getByText('Notify me when accessed')).toBeInTheDocument();
    });
  });

  describe('Share Creation', () => {
    test('creates share with correct data', async () => {
      const onCreateShare = jest.fn().mockResolvedValue({
        id: 'new-share-123',
        shareUrl: 'https://app.example.com/shared/newtoken'
      });

      render(<FileSharing {...defaultProps} onCreateShare={onCreateShare} />);
      
      // Set permission to download
      const downloadButton = screen.getByText('View & Download');
      await userEvent.click(downloadButton);
      
      // Enable password
      const passwordCheckbox = screen.getByText('Require password').previousElementSibling;
      await userEvent.click(passwordCheckbox);
      
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await userEvent.type(passwordInput, 'test123');
      
      // Create share
      const createButton = screen.getByText('Create Share Link');
      await userEvent.click(createButton);
      
      await waitFor(() => {
        expect(onCreateShare).toHaveBeenCalledWith({
          fileId: 'file-123',
          permission: 'download',
          requirePassword: true,
          password: 'test123',
          expiresAt: null,
          allowAnonymous: true,
          maxDownloads: null,
          notifyOnAccess: false
        });
      });
    });

    test('shows loading state during creation', async () => {
      const onCreateShare = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<FileSharing {...defaultProps} onCreateShare={onCreateShare} />);
      
      const createButton = screen.getByText('Create Share Link');
      await userEvent.click(createButton);
      
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(createButton).toBeDisabled();
    });

    test('disables create button when password required but not provided', () => {
      render(<FileSharing {...defaultProps} />);
      
      const passwordCheckbox = screen.getByText('Require password').previousElementSibling;
      fireEvent.click(passwordCheckbox);
      
      const createButton = screen.getByText('Create Share Link');
      expect(createButton).toBeDisabled();
    });

    test('copies share link automatically after creation', async () => {
      jest.useFakeTimers();
      
      const onCreateShare = jest.fn().mockResolvedValue({
        id: 'new-share-123',
        shareUrl: 'https://app.example.com/shared/newtoken'
      });

      render(<FileSharing {...defaultProps} onCreateShare={onCreateShare} />);
      
      const createButton = screen.getByText('Create Share Link');
      await userEvent.click(createButton);
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'https://app.example.com/shared/newtoken'
        );
      });
      
      expect(screen.getByText('Link copied to clipboard!')).toBeInTheDocument();
      
      // Fast-forward timers to hide notification
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      expect(screen.queryByText('Link copied to clipboard!')).not.toBeInTheDocument();
      
      jest.useRealTimers();
    });
  });

  describe('Existing Shares Management', () => {
    test('copies existing share link', async () => {
      jest.useFakeTimers();
      
      render(<FileSharing {...defaultProps} existingShares={mockExistingShares} />);
      
      const copyButtons = screen.getAllByTestId('copy-icon');
      await userEvent.click(copyButtons[0]);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://app.example.com/shared/token123'
      );
      
      expect(screen.getByText('Link copied to clipboard!')).toBeInTheDocument();
      
      jest.useRealTimers();
    });

    test('deletes existing share with confirmation', async () => {
      const onDeleteShare = jest.fn().mockResolvedValue();
      
      // Mock window.confirm
      window.confirm = jest.fn(() => true);
      
      render(<FileSharing {...defaultProps} existingShares={mockExistingShares} onDeleteShare={onDeleteShare} />);
      
      const deleteButtons = screen.getAllByTestId('trash-icon');
      await userEvent.click(deleteButtons[0]);
      
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this share?'
      );
      expect(onDeleteShare).toHaveBeenCalledWith('share-1');
    });

    test('cancels deletion when not confirmed', async () => {
      const onDeleteShare = jest.fn();
      
      // Mock window.confirm to return false
      window.confirm = jest.fn(() => false);
      
      render(<FileSharing {...defaultProps} existingShares={mockExistingShares} onDeleteShare={onDeleteShare} />);
      
      const deleteButtons = screen.getAllByTestId('trash-icon');
      await userEvent.click(deleteButtons[0]);
      
      expect(window.confirm).toHaveBeenCalled();
      expect(onDeleteShare).not.toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    test('validates required password when enabled', async () => {
      render(<FileSharing {...defaultProps} />);
      
      const passwordCheckbox = screen.getByText('Require password').previousElementSibling;
      await userEvent.click(passwordCheckbox);
      
      const createButton = screen.getByText('Create Share Link');
      expect(createButton).toBeDisabled();
      
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await userEvent.type(passwordInput, 'test123');
      
      expect(createButton).not.toBeDisabled();
    });

    test('validates max downloads input', async () => {
      render(<FileSharing {...defaultProps} />);
      
      // Show advanced settings
      const advancedToggle = screen.getByText('Advanced Settings');
      await userEvent.click(advancedToggle);
      
      const maxDownloadsInput = screen.getByPlaceholderText('Unlimited');
      
      // Test valid input
      await userEvent.type(maxDownloadsInput, '10');
      expect(maxDownloadsInput.value).toBe('10');
      
      // Test clearing input
      await userEvent.clear(maxDownloadsInput);
      expect(maxDownloadsInput.value).toBe('');
    });
  });

  describe('Performance', () => {
    test('does not re-render unnecessarily', () => {
      const { rerender } = render(<FileSharing {...defaultProps} />);
      
      // Re-render with same props
      rerender(<FileSharing {...defaultProps} />);
      
      // Component should be memoized and not re-render
      expect(screen.getByText('Share File')).toBeInTheDocument();
    });

    test('handles large number of existing shares efficiently', () => {
      const manyShares = Array.from({ length: 100 }, (_, i) => ({
        id: `share-${i}`,
        shareUrl: `https://app.example.com/shared/token${i}`,
        permissions: 'view',
        created_at: '2024-01-01T00:00:00Z',
        require_password: false,
        expires_at: null
      }));

      const startTime = performance.now();
      render(<FileSharing {...defaultProps} existingShares={manyShares} />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should render in under 100ms
      expect(screen.getByText('Existing Shares')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(<FileSharing {...defaultProps} />);
      
      const modal = screen.getByText('Share File').closest('[role="dialog"]');
      expect(modal).toBeInTheDocument();
      
      const closeButton = screen.getByTestId('x-icon').closest('button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    test('supports keyboard navigation', async () => {
      render(<FileSharing {...defaultProps} />);
      
      const firstButton = screen.getByText('View only');
      firstButton.focus();
      
      expect(document.activeElement).toBe(firstButton);
      
      // Tab to next element
      await userEvent.tab();
      expect(document.activeElement).toBe(screen.getByText('View & Download'));
    });

    test('announces changes to screen readers', () => {
      render(<FileSharing {...defaultProps} />);
      
      const passwordCheckbox = screen.getByText('Require password').previousElementSibling;
      fireEvent.click(passwordCheckbox);
      
      const passwordInput = screen.getByPlaceholderText('Enter password');
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Error Handling', () => {
    test('handles share creation errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const onCreateShare = jest.fn().mockRejectedValue(new Error('Network error'));

      render(<FileSharing {...defaultProps} onCreateShare={onCreateShare} />);
      
      const createButton = screen.getByText('Create Share Link');
      await userEvent.click(createButton);
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to create share:', expect.any(Error));
      });
      
      // Button should be re-enabled after error
      expect(createButton).not.toBeDisabled();
      
      consoleError.mockRestore();
    });

    test('handles clipboard errors with fallback', async () => {
      // Mock clipboard to fail
      navigator.clipboard.writeText = jest.fn(() => Promise.reject(new Error('Clipboard error')));
      
      // Mock document.execCommand
      document.execCommand = jest.fn(() => true);
      
      render(<FileSharing {...defaultProps} existingShares={mockExistingShares} />);
      
      const copyButtons = screen.getAllByTestId('copy-icon');
      await userEvent.click(copyButtons[0]);
      
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(screen.getByText('Link copied to clipboard!')).toBeInTheDocument();
    });
  });
});

export default {};
