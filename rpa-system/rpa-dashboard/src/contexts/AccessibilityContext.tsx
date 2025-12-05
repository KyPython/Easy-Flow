import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilitySettings, ColorBlindMode } from '../types/index.ts';
import { mockStore } from '../data/accessibleOSMockData.ts';

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<AccessibilitySettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  announceToScreenReader: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(mockStore.accessibilitySettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme
    if (settings.highContrastMode) {
      root.setAttribute('data-theme', 'high-contrast');
    }
    
    // Apply font size scaling
    if (settings.fontSizeMultiplier > 1.2) {
      root.setAttribute('data-font-scale', 'large');
    } else if (settings.fontSizeMultiplier > 1.5) {
      root.setAttribute('data-font-scale', 'extra-large');
    }
    
    // Apply motion preferences
    if (settings.motionReduced) {
      root.setAttribute('data-motion', 'reduced');
    }
    
    // Apply color blind mode
    if (settings.colorBlindMode) {
      root.setAttribute('data-color-blind', settings.colorBlindMode);
    }
    
    // Apply custom CSS
    if (settings.customCss) {
      let styleElement = document.getElementById('accessibility-custom-css');
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'accessibility-custom-css';
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = settings.customCss;
    }
  }, [settings]);

  const updateSettings = async (updates: Partial<AccessibilitySettings>): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedSettings = {
        ...settings,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      setSettings(updatedSettings);
      announceToScreenReader('Accessibility settings updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const defaultSettings: AccessibilitySettings = {
        ...mockStore.accessibilitySettings,
        voiceOverEnabled: false,
        voiceOverSpeed: 1.0,
        keyboardNavigationEnabled: true,
        highContrastMode: false,
        fontSizeMultiplier: 1.0,
        screenReaderEnabled: false,
        motionReduced: false,
        colorBlindMode: null,
        customCss: '',
        updatedAt: new Date().toISOString()
      };
      
      setSettings(defaultSettings);
      announceToScreenReader('Accessibility settings reset to defaults');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const announceToScreenReader = (message: string): void => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  const value: AccessibilityContextType = {
    settings,
    loading,
    error,
    updateSettings,
    resetSettings,
    announceToScreenReader
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};