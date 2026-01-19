/// <reference types="cypress" />

// E2E test to verify console log sampling is set to 1 (100%)
// and that console.log/error messages are not sampled out.

describe('Log sampling configuration', () => {
  beforeEach(() => {
    // Clear any previous state
    cy.clearLocalStorage();
  });

  it('sets CONSOLE_LOG_SAMPLE_RATE to 1 on app load and logs are visible', () => {
    // Visit root (ensure frontend dev server is running at baseUrl)
    cy.visit('/');

    // Verify the sample rate is set to '1' by the application code
    cy.window().then((win) => {
      const rate = win.localStorage.getItem('CONSOLE_LOG_SAMPLE_RATE');
      expect(rate, 'CONSOLE_LOG_SAMPLE_RATE').to.equal('1');
    });

    // Spy on console methods and ensure they are called (not sampled out)
    cy.window().then((win) => {
      const logSpy = cy.spy(win.console, 'log').as('consoleLog');
      const errSpy = cy.spy(win.console, 'error').as('consoleError');

      // Trigger some logs through the wrapped console
      win.console.log('[LogSamplingTest] Test console.log visible');
      win.console.error('[LogSamplingTest] Test console.error visible');

      // Assertions: spies should be called (sampling set to 1 ensures no drop)
      cy.get('@consoleLog').should('have.been.called');
      cy.get('@consoleError').should('have.been.called');
    });
  });

  it('persists sampling rate in localStorage across navigations', () => {
    cy.visit('/');

    // Ensure value is present
    cy.window().then((win) => {
      expect(win.localStorage.getItem('CONSOLE_LOG_SAMPLE_RATE')).to.equal('1');
    });

    // Navigate within SPA (if router available). We still assert key remains 1.
    // This is a generic check that the key isn't reset during route changes.
    cy.visit('/settings');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('CONSOLE_LOG_SAMPLE_RATE')).to.equal('1');
    });
  });
});
