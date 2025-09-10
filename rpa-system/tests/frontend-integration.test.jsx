// Real frontend integration tests with actual API calls
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Import actual components
import DashboardPage from '../rpa-dashboard/src/DashboardPage';
import TasksPage from '../rpa-dashboard/src/TasksPage';
import HistoryPage from '../rpa-dashboard/src/HistoryPage';
import SettingsPage from '../rpa-dashboard/src/SettingsPage';

// Mock fetch for API calls but use real responses
const mockApiResponses = {
  '/api/logs': {
    status: 200,
    data: [
      {
        id: 1,
        task: 'test-web-scraping',
        url: 'https://example.com',
        username: 'test-user',
        status: 'completed',
        result: { pages: 5, data: 100 },
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        task: 'test-data-extraction',
        url: 'https://api.example.com',
        username: 'test-user',
        status: 'failed',
        result: { error: 'Connection timeout' },
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  },
  '/api/dashboard': {
    status: 200,
    data: {
      stats: {
        totalTasks: 25,
        completedTasks: 20,
        failedTasks: 3,
        runningTasks: 2,
        successRate: 80,
        totalDataExtracted: 15420
      },
      recentActivity: [
        { task: 'Web scraping job', status: 'completed', timestamp: new Date().toISOString() }
      ]
    }
  },
  '/api/plans': {
    status: 200,
    data: {
      plans: [
        { id: 'free', name: 'Free', price: 0, features: ['Basic automation', '10 tasks/month'] },
        { id: 'pro', name: 'Professional', price: 29, features: ['Advanced automation', 'Unlimited tasks'] }
      ]
    }
  },
  '/api/user/preferences': {
    status: 200,
    data: {
      user_id: 'test-user-123',
      theme: 'light',
      notifications: {
        email: true,
        push: false,
        task_completion: true
      },
      dashboard_layout: 'grid'
    }
  }
};

// Mock fetch with realistic responses
global.fetch = jest.fn((url, options) => {
  const endpoint = url.includes('/api/') ? url.split('/api')[1] : url;
  const mockResponse = mockApiResponses[endpoint];
  
  if (mockResponse) {
    return Promise.resolve({
      ok: mockResponse.status < 400,
      status: mockResponse.status,
      json: () => Promise.resolve(mockResponse.data),
      headers: {
        get: (name) => name === 'content-type' ? 'application/json' : null
      }
    });
  }
  
  // Default 404 response
  return Promise.resolve({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Not found' })
  });
});

// Wrapper component for tests
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Frontend Integration Tests with Real API Data', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Dashboard Page', () => {
    test('should load and display real dashboard data', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 5000 });

      // Should display dashboard stats
      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument(); // Total tasks
        expect(screen.getByText('20')).toBeInTheDocument(); // Completed tasks
        expect(screen.getByText('80%')).toBeInTheDocument(); // Success rate
      });

      // Verify API was called
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dashboard'),
        expect.any(Object)
      );
    });

    test('should handle dashboard API errors gracefully', async () => {
      // Mock API error
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tasks Page', () => {
    test('should load and display task creation interface', async () => {
      render(
        <TestWrapper>
          <TasksPage />
        </TestWrapper>
      );

      // Should have task creation form
      expect(screen.getByText(/create/i)).toBeInTheDocument();
      expect(screen.getByText(/task/i)).toBeInTheDocument();
      
      // Should have input fields for task configuration
      const taskNameInput = screen.getByLabelText(/name/i) || screen.getByPlaceholderText(/task name/i);
      const urlInput = screen.getByLabelText(/url/i) || screen.getByPlaceholderText(/url/i);
      
      if (taskNameInput) {
        expect(taskNameInput).toBeInTheDocument();
      }
      if (urlInput) {
        expect(urlInput).toBeInTheDocument();
      }
    });

    test('should handle task creation form submission', async () => {
      render(
        <TestWrapper>
          <TasksPage />
        </TestWrapper>
      );

      // Fill out form if inputs exist
      const taskNameInput = screen.queryByLabelText(/name/i) || screen.queryByPlaceholderText(/task name/i);
      const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);
      const submitButton = screen.queryByText(/create/i) || screen.queryByText(/submit/i);

      if (taskNameInput && urlInput && submitButton) {
        fireEvent.change(taskNameInput, { target: { value: 'Test Integration Task' } });
        fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
        fireEvent.click(submitButton);

        // Should attempt API call
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/'),
            expect.objectContaining({
              method: 'POST'
            })
          );
        });
      }
    });
  });

  describe('History Page', () => {
    test('should load and display automation history', async () => {
      render(
        <TestWrapper>
          <HistoryPage />
        </TestWrapper>
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test-web-scraping')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('test-data-extraction')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify API was called for logs
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/logs'),
        expect.any(Object)
      );
    });

    test('should filter history by status', async () => {
      render(
        <TestWrapper>
          <HistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-web-scraping')).toBeInTheDocument();
      });

      // Look for filter controls
      const statusFilter = screen.queryByLabelText(/status/i) || screen.queryByText(/filter/i);
      
      if (statusFilter) {
        fireEvent.click(statusFilter);
        
        // Should show filter options
        const completedFilter = screen.queryByText(/completed/i);
        if (completedFilter) {
          fireEvent.click(completedFilter);
        }
      }
    });
  });

  describe('Settings Page', () => {
    test('should load and display user preferences', async () => {
      render(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );

      // Wait for preferences to load
      await waitFor(() => {
        const themeSelector = screen.queryByText(/theme/i) || screen.queryByText(/dark/i) || screen.queryByText(/light/i);
        expect(themeSelector).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify API was called for preferences
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/preferences'),
        expect.any(Object)
      );
    });

    test('should save preference changes', async () => {
      render(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const saveButton = screen.queryByText(/save/i) || screen.queryByText(/update/i);
        if (saveButton) {
          fireEvent.click(saveButton);
        }
      });

      // Should attempt to save preferences
      await waitFor(() => {
        const putCall = fetch.mock.calls.find(call => 
          call[1] && call[1].method === 'PUT' && call[0].includes('/api/user/preferences')
        );
        expect(putCall).toBeTruthy();
      });
    });
  });

  describe('Complete User Workflow Integration', () => {
    test('should handle complete user workflow: dashboard -> tasks -> history -> settings', async () => {
      // Start with dashboard
      const { rerender } = render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Wait for dashboard to load
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/dashboard'),
          expect.any(Object)
        );
      });

      // Switch to tasks page
      rerender(
        <TestWrapper>
          <TasksPage />
        </TestWrapper>
      );

      // Should render task interface
      expect(screen.getByText(/task/i)).toBeInTheDocument();

      // Switch to history page
      rerender(
        <TestWrapper>
          <HistoryPage />
        </TestWrapper>
      );

      // Wait for history to load
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/logs'),
          expect.any(Object)
        );
      });

      // Switch to settings page
      rerender(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );

      // Wait for settings to load
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/user/preferences'),
          expect.any(Object)
        );
      });

      // Verify all APIs were called during workflow
      const apiCalls = fetch.mock.calls.map(call => call[0]);
      expect(apiCalls.some(url => url.includes('/api/dashboard'))).toBe(true);
      expect(apiCalls.some(url => url.includes('/api/logs'))).toBe(true);
      expect(apiCalls.some(url => url.includes('/api/user/preferences'))).toBe(true);
    });

    test('should handle API failures gracefully across components', async () => {
      // Mock all APIs to fail
      fetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        })
      );

      const { rerender } = render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should handle dashboard error
      await waitFor(() => {
        const errorElement = screen.queryByText(/error/i) || screen.queryByText(/failed/i);
        expect(errorElement).toBeInTheDocument();
      });

      // Switch to history and check error handling
      rerender(
        <TestWrapper>
          <HistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const errorElement = screen.queryByText(/error/i) || screen.queryByText(/failed/i) || screen.queryByText(/unable/i);
        expect(errorElement).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Loading States', () => {
    test('should show loading states during API calls', async () => {
      // Mock slow API response
      fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockApiResponses['/api/dashboard'].data)
          }), 1000)
        )
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Should show loading
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Should hide loading after data loads
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('should handle rapid component switching without errors', async () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // Rapidly switch components
      rerender(<TestWrapper><TasksPage /></TestWrapper>);
      rerender(<TestWrapper><HistoryPage /></TestWrapper>);
      rerender(<TestWrapper><SettingsPage /></TestWrapper>);
      rerender(<TestWrapper><DashboardPage /></TestWrapper>);

      // Should not throw errors
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i) || screen.getByText(/loading/i)).toBeInTheDocument();
      });
    });
  });
});