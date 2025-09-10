// Simple test to verify Jest configuration
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock component for testing setup
const TestComponent = () => {
  return <div data-testid="test-component">Test Component</div>;
};

describe('Jest Configuration Test', () => {
  test('should render test component', () => {
    render(<TestComponent />);
    const element = screen.getByTestId('test-component');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Test Component');
  });

  test('should handle basic functionality', () => {
    expect(1 + 1).toBe(2);
    expect('hello world').toContain('world');
  });

  test('should support async operations', async () => {
    const promise = Promise.resolve('async test');
    const result = await promise;
    expect(result).toBe('async test');
  });
});

describe('Environment Setup', () => {
  test('should have jsdom environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  test('should support ES6 features', () => {
    const arr = [1, 2, 3];
    const doubled = arr.map(x => x * 2);
    expect(doubled).toEqual([2, 4, 6]);
  });

  test('should handle React features', () => {
    const Component = () => React.createElement('div', null, 'React Test');
    expect(typeof Component).toBe('function');
  });
});
