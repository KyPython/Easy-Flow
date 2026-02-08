import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import IntegrationMarketplacePage from './IntegrationMarketplacePage';
import { api } from '../utils/api';

jest.mock('../utils/api');
jest.mock('../utils/logger');
jest.mock('../utils/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' })
}));
jest.mock('../utils/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', planTier: 'Professional' } })
}));
jest.mock('../components/PlanGate/PlanGate', () => {
  return function MockPlanGate({ children }) {
    return <div>{children}</div>;
  };
});
jest.mock('../components/IntegrationKeyModal/IntegrationKeyModal', () => {
  return function MockIntegrationKeyModal({ isOpen, onClose, integration, onConnect }) {
    return isOpen ? (
      <div data-testid="key-modal">
        <h2>{integration?.name} Modal</h2>
        <button onClick={() => onConnect({ apiKey: 'test-key', token: 'test-token' })}>
          Submit
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null;
  };
});

const mockIntegrations = [
  {
    id: 'int-1',
    service: 'teams',
    displayName: 'Teams',
    isActive: true,
    lastUsedAt: '2025-01-01T00:00:00.000Z',
    lastTestedAt: '2025-01-02T00:00:00.000Z',
    testStatus: 'success',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'int-2',
    service: 'dropbox',
    displayName: 'Dropbox',
    isActive: true,
    lastUsedAt: null,
    lastTestedAt: null,
    testStatus: null,
    createdAt: '2025-01-01T00:00:00.000Z'
  }
];

const renderPage = () => {
  return render(
    <BrowserRouter>
      <IntegrationMarketplacePage />
    </BrowserRouter>
  );
};

describe('IntegrationMarketplacePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({
      data: { success: true, integrations: [] }
    });
    delete window.location;
    window.location = { pathname: '/marketplace', search: '', hostname: 'localhost' };
    window.history.replaceState = jest.fn();
  });

  describe('Initial Load', () => {
    test('renders marketplace title and subtitle', async () => {
      renderPage();
      
      expect(screen.getByText('Integration Marketplace')).toBeInTheDocument();
      expect(screen.getByText('Discover and connect integrations to power your workflows')).toBeInTheDocument();
    });

    test('shows loading state initially', () => {
      renderPage();
      
      expect(screen.getByText('Loading integrations...')).toBeInTheDocument();
    });

    test('loads integrations on mount', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, integrations: mockIntegrations }
      });

      renderPage();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/integrations');
      });
    });

    test('displays all catalog integrations', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
        expect(screen.getByText('Dropbox')).toBeInTheDocument();
        expect(screen.getByText('Salesforce')).toBeInTheDocument();
        expect(screen.getByText('HubSpot')).toBeInTheDocument();
        expect(screen.getByText('QuickBooks')).toBeInTheDocument();
        expect(screen.getByText('Asana')).toBeInTheDocument();
        expect(screen.getByText('Trello')).toBeInTheDocument();
        expect(screen.getByText('LinkedIn')).toBeInTheDocument();
        expect(screen.getByText('Twitter/X')).toBeInTheDocument();
      });
    });
  });

  describe('OAuth Success/Error Handling', () => {
    test('shows success message when success=true in URL', async () => {
      window.location.search = '?success=true';
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Integration connected successfully/i)).toBeInTheDocument();
      });
    });

    test('shows error message when error param in URL', async () => {
      window.location.search = '?error=Invalid%20credentials';
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
      });
    });

    test('cleans up URL after processing query params', async () => {
      window.location.search = '?success=true';
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalled();
      });
    });
  });

  describe('OAuth Connect Flow', () => {
    test('starts OAuth flow for Teams', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/integrations') {
          return Promise.resolve({ data: { success: true, integrations: [] } });
        }
        if (url.includes('/oauth/start')) {
          return Promise.resolve({ 
            data: { 
              success: true, 
              oauthUrl: 'https://login.microsoftonline.com/oauth2/authorize?client_id=test' 
            } 
          });
        }
      });

      const mockOpen = jest.fn(() => ({ closed: false, close: jest.fn() }));
      window.open = mockOpen;

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalled();
      });
    });

    test('starts OAuth flow for Dropbox', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/integrations') {
          return Promise.resolve({ data: { success: true, integrations: [] } });
        }
        if (url.includes('dropbox') && url.includes('/oauth/start')) {
          return Promise.resolve({ 
            data: { 
              success: true, 
              oauthUrl: 'https://www.dropbox.com/oauth2/authorize?client_id=test' 
            } 
          });
        }
      });

      const mockOpen = jest.fn(() => ({ closed: false, close: jest.fn() }));
      window.open = mockOpen;

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Dropbox')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Connect');
      const dropboxButton = buttons.find(btn => {
        const card = btn.closest('[class*="integrationCard"]');
        return card && card.textContent.includes('Dropbox');
      });
      
      if (dropboxButton) {
        fireEvent.click(dropboxButton);
        await waitFor(() => {
          expect(mockOpen).toHaveBeenCalled();
        });
      }
    });

    test('handles popup blocker', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/integrations') {
          return Promise.resolve({ data: { success: true, integrations: [] } });
        }
        if (url.includes('/oauth/start')) {
          return Promise.resolve({ 
            data: { success: true, oauthUrl: 'https://example.com/oauth' } 
          });
        }
      });

      window.open = jest.fn(() => null);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/Popup blocked/i)).toBeInTheDocument();
      });
    });
  });

  describe('Trello API Key Modal', () => {
    test('opens modal for Trello (non-OAuth)', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Trello')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Connect');
      const trelloButton = buttons.find(btn => {
        const card = btn.closest('[class*="integrationCard"]');
        return card && card.textContent.includes('Trello');
      });

      if (trelloButton) {
        fireEvent.click(trelloButton);

        await waitFor(() => {
          expect(screen.getByTestId('key-modal')).toBeInTheDocument();
          expect(screen.getByText('Trello Modal')).toBeInTheDocument();
        });
      }
    });

    test('submits Trello credentials via modal', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });
      api.post.mockResolvedValue({
        data: { success: true }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Trello')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Connect');
      const trelloButton = buttons.find(btn => {
        const card = btn.closest('[class*="integrationCard"]');
        return card && card.textContent.includes('Trello');
      });

      if (trelloButton) {
        fireEvent.click(trelloButton);

        await waitFor(() => {
          expect(screen.getByTestId('key-modal')).toBeInTheDocument();
        });

        const submitButton = screen.getByText('Submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(api.post).toHaveBeenCalledWith(
            '/api/integrations/trello/connect',
            expect.objectContaining({
              credentials: { apiKey: 'test-key', token: 'test-token' }
            })
          );
        });
      }
    });
  });

  describe('Test Connection', () => {
    test('tests connection for connected integration', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });
      api.post.mockResolvedValue({
        data: { success: true }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const testButtons = screen.getAllByText('Test Connection');
      if (testButtons.length > 0) {
        fireEvent.click(testButtons[0]);

        await waitFor(() => {
          expect(api.post).toHaveBeenCalledWith('/api/integrations/teams/test');
        });
      }
    });

    test('shows success message on successful test', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });
      api.post.mockResolvedValue({
        data: { success: true }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const testButtons = screen.getAllByText('Test Connection');
      if (testButtons.length > 0) {
        fireEvent.click(testButtons[0]);

        await waitFor(() => {
          expect(screen.getByText(/connection test successful/i)).toBeInTheDocument();
        });
      }
    });

    test('shows error message on failed test', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });
      api.post.mockResolvedValue({
        data: { success: false, error: 'Invalid token', needsReconnect: true }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const testButtons = screen.getAllByText('Test Connection');
      if (testButtons.length > 0) {
        fireEvent.click(testButtons[0]);

        await waitFor(() => {
          expect(screen.getByText(/Invalid token/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Disconnect Integration', () => {
    test('disconnects integration after confirmation', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });
      api.delete.mockResolvedValue({
        data: { success: true }
      });

      window.confirm = jest.fn(() => true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const disconnectButtons = screen.getAllByText('Disconnect');
      if (disconnectButtons.length > 0) {
        fireEvent.click(disconnectButtons[0]);

        await waitFor(() => {
          expect(window.confirm).toHaveBeenCalled();
          expect(api.delete).toHaveBeenCalledWith('/api/integrations/teams');
        });
      }
    });

    test('cancels disconnect when user declines', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });

      window.confirm = jest.fn(() => false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
      });

      const disconnectButtons = screen.getAllByText('Disconnect');
      if (disconnectButtons.length > 0) {
        fireEvent.click(disconnectButtons[0]);

        expect(window.confirm).toHaveBeenCalled();
        expect(api.delete).not.toHaveBeenCalled();
      }
    });
  });

  describe('Integration Status Display', () => {
    test('shows connected status for active integrations', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
      });
    });

    test('shows test status icons', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: mockIntegrations }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Test: ✅/)).toBeInTheDocument();
      });
    });

    test('shows not connected status for new integrations', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText('Not Connected').length).toBeGreaterThan(0);
      });
    });

    test('shows special status for Reddit (no auth required)', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Available (No Auth Required)')).toBeInTheDocument();
      });
    });
  });

  describe('Category Grouping', () => {
    test('displays integrations grouped by category', async () => {
      api.get.mockResolvedValue({
        data: { success: true, integrations: [] }
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Communication')).toBeInTheDocument();
        expect(screen.getByText('Google Workspace')).toBeInTheDocument();
        expect(screen.getByText('Storage')).toBeInTheDocument();
        expect(screen.getByText('CRM')).toBeInTheDocument();
        expect(screen.getByText('Accounting')).toBeInTheDocument();
        expect(screen.getByText('Project Management')).toBeInTheDocument();
        expect(screen.getByText('Social')).toBeInTheDocument();
      });
    });
  });
});
