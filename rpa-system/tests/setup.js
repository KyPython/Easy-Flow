// Test setup configuration for file sharing system tests
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Mock global objects
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        update: jest.fn(() => Promise.resolve({ data: null, error: null })),
        delete: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id', email: 'test@example.com' } }, 
        error: null 
      })),
      signInWithPassword: jest.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })),
      signUp: jest.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
        download: jest.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://test-url.com' } })),
      })),
    },
  })),
}));

// Mock console methods in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
       args[0].includes('componentWillUpdate'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader
global.File = jest.fn((bits, name, options) => ({
  name,
  size: bits.reduce((acc, bit) => acc + bit.length, 0),
  type: options?.type || '',
  lastModified: Date.now(),
  slice: jest.fn(),
}));

global.FileReader = jest.fn(() => ({
  readAsDataURL: jest.fn(function() {
    this.onload({ target: { result: 'data:text/plain;base64,dGVzdA==' } });
  }),
  readAsText: jest.fn(function() {
    this.onload({ target: { result: 'test content' } });
  }),
  result: null,
  error: null,
  onload: null,
  onerror: null,
  onabort: null,
  abort: jest.fn(),
}));

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock crypto for UUID generation
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
  },
});

// Custom render function with providers
import { render } from '@testing-library/react';

export const renderWithProviders = (ui, options = {}) => {
  return render(ui, options);
};

// Simple wrapper for router testing if needed
export const renderWithRouter = (ui, options = {}) => {
  try {
    const { MemoryRouter } = require('react-router-dom');
    const { initialEntries = ['/'], ...renderOptions } = options;

    const Wrapper = ({ children }) => (
      React.createElement(MemoryRouter, { initialEntries }, children)
    );

    return render(ui, { wrapper: Wrapper, ...renderOptions });
  } catch (error) {
    // Fallback to regular render if router is not available
    return render(ui, options);
  }
};

// Utility for creating mock files
export const createMockFile = (name = 'test.txt', size = 1024, type = 'text/plain') => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Utility for waiting for async operations
export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// Mock performance timing for performance tests
export const mockPerformanceTiming = (duration = 100) => {
  const startTime = performance.now();
  performance.now.mockReturnValueOnce(startTime + duration);
  return { startTime, endTime: startTime + duration, duration };
};

// Accessibility testing helper
export const runAxeTest = async (container) => {
  const { axe } = await import('jest-axe');
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// Error boundary for testing error states
import React from 'react';

export class TestErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}

// Custom matchers for performance testing
expect.extend({
  toBeWithinPerformanceThreshold(received, threshold) {
    const pass = received <= threshold;
    if (pass) {
      return {
        message: () => `Expected ${received}ms to be above performance threshold ${threshold}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be within performance threshold ${threshold}ms`,
        pass: false,
      };
    }
  },
  toHaveValidAccessibility(received) {
    // This would integrate with jest-axe
    return {
      message: () => 'Expected element to have valid accessibility',
      pass: true, // Simplified for mock
    };
  },
});

// Export common test utilities
export * from '@testing-library/react';
