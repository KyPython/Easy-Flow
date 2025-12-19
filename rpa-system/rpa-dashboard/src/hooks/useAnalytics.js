import { useEffect } from 'react';
import ReactGA from 'react-ga4';

/**
 * Custom hook for Google Analytics tracking with domain-specific configuration
 * Handles both development and production environments
 */
export const useAnalytics = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = isProduction ? 'www.tryeasyflow.com' : 'localhost';
  const baseUrl = isProduction ? 'https://www.tryeasyflow.com' : 'http://localhost:3000';

  // Track page views with domain information
  const trackPageView = (path, search = '') => {
    if (!process.env.REACT_APP_GA_MEASUREMENT_ID) return;
    
    ReactGA.send({
      hitType: 'pageview',
      page: path + search,
      location: `${baseUrl}${path}${search}`,
      title: document.title
    });
  };

  // Track events with domain context
  const trackEvent = (eventName, parameters = {}) => {
    if (!process.env.REACT_APP_GA_MEASUREMENT_ID) return;
    
    ReactGA.event(eventName, {
      ...parameters,
      domain: domain,
      environment: process.env.NODE_ENV
    });
  };

  // Track custom events for your EasyFlow application
  const trackEasyFlowEvent = (action, category = 'EasyFlow', label = '', value = 0) => {
    trackEvent(action, {
      event_category: category,
      event_label: label,
      value: value,
      domain: domain
    });
  };

  return {
    trackPageView,
    trackEvent,
    trackEasyFlowEvent,
    domain,
    baseUrl,
    isDevelopment,
    isProduction
  };
};

export default useAnalytics;
