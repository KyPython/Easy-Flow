import React, { useState } from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { AccessibilitySettings as Settings } from '../../types';
import styles from './AccessibilitySettings.module.css';

const AccessibilitySettings: React.FC = () => {
  const { settings, loading, updateSettings } = useAccessibility();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSettingChange = async (key: keyof Settings, value: any) => {
    if (!settings) return;

    try {
      setSaving(true);
      await updateSettings({ [key]: value });
      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save settings');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSliderChange = (key: keyof Settings, value: string) => {
    const numValue = parseFloat(value);
    handleSettingChange(key, numValue);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>Loading accessibility settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={styles.error}>
        <h3>Settings Not Found</h3>
        <p>Unable to load accessibility settings. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className={styles.accessibilitySettings}>
      <div className={styles.header}>
        <h2>Accessibility Settings</h2>
        <p>Customize your experience to meet your accessibility needs</p>
        {message && (
          <div className={`${styles.message} ${message.includes('Failed') ? styles.error : styles.success}`}>
            {message}
          </div>
        )}
      </div>

      <div className={styles.settingsGrid}>
        {/* Visual Settings */}
        <section className={styles.settingsSection}>
          <h3>Visual Settings</h3>
          
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="highContrast" className={styles.settingLabel}>
                High Contrast Mode
              </label>
              <p className={styles.settingDescription}>
                Increases contrast between text and background for better readability
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                id="highContrast"
                checked={settings.highContrastMode}
                onChange={(e) => handleSettingChange('highContrastMode', e.target.checked)}
                disabled={saving}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="fontSize" className={styles.settingLabel}>
                Font Size: {settings.fontSizeMultiplier}x
              </label>
              <p className={styles.settingDescription}>
                Adjust text size throughout the application
              </p>
            </div>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                id="fontSize"
                min="0.8"
                max="2.0"
                step="0.1"
                value={settings.fontSizeMultiplier}
                onChange={(e) => handleSliderChange('fontSizeMultiplier', e.target.value)}
                className={styles.slider}
                disabled={saving}
              />
              <div className={styles.sliderLabels}>
                <span>0.8x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="colorBlindMode" className={styles.settingLabel}>
                Color Blind Support
              </label>
              <p className={styles.settingDescription}>
                Adjust colors for different types of color blindness
              </p>
            </div>
            <select
              id="colorBlindMode"
              value={settings.colorBlindMode || ''}
              onChange={(e) => handleSettingChange('colorBlindMode', e.target.value || null)}
              className={styles.select}
              disabled={saving}
            >
              <option value="">None</option>
              <option value="protanopia">Protanopia (Red-blind)</option>
              <option value="deuteranopia">Deuteranopia (Green-blind)</option>
              <option value="tritanopia">Tritanopia (Blue-blind)</option>
            </select>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="motionReduced" className={styles.settingLabel}>
                Reduce Motion
              </label>
              <p className={styles.settingDescription}>
                Minimize animations and transitions that may cause discomfort
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                id="motionReduced"
                checked={settings.motionReduced}
                onChange={(e) => handleSettingChange('motionReduced', e.target.checked)}
                disabled={saving}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        </section>

        {/* Audio Settings */}
        <section className={styles.settingsSection}>
          <h3>Audio & Voice Settings</h3>
          
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="voiceOver" className={styles.settingLabel}>
                Voice-Over
              </label>
              <p className={styles.settingDescription}>
                Enable voice narration for interface elements
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                id="voiceOver"
                checked={settings.voiceOverEnabled}
                onChange={(e) => handleSettingChange('voiceOverEnabled', e.target.checked)}
                disabled={saving}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          {settings.voiceOverEnabled && (
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <label htmlFor="voiceSpeed" className={styles.settingLabel}>
                  Voice Speed: {settings.voiceOverSpeed}x
                </label>
                <p className={styles.settingDescription}>
                  Adjust the speed of voice narration
                </p>
              </div>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  id="voiceSpeed"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.voiceOverSpeed}
                  onChange={(e) => handleSliderChange('voiceOverSpeed', e.target.value)}
                  className={styles.slider}
                  disabled={saving}
                />
                <div className={styles.sliderLabels}>
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="screenReader" className={styles.settingLabel}>
                Screen Reader Optimization
              </label>
              <p className={styles.settingDescription}>
                Optimize interface for screen reader compatibility
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                id="screenReader"
                checked={settings.screenReaderEnabled}
                onChange={(e) => handleSettingChange('screenReaderEnabled', e.target.checked)}
                disabled={saving}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        </section>

        {/* Navigation Settings */}
        <section className={styles.settingsSection}>
          <h3>Navigation Settings</h3>
          
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="keyboardNav" className={styles.settingLabel}>
                Enhanced Keyboard Navigation
              </label>
              <p className={styles.settingDescription}>
                Enable advanced keyboard shortcuts and focus indicators
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                id="keyboardNav"
                checked={settings.keyboardNavigationEnabled}
                onChange={(e) => handleSettingChange('keyboardNavigationEnabled', e.target.checked)}
                disabled={saving}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        </section>

        {/* Custom CSS */}
        <section className={styles.settingsSection}>
          <h3>Advanced Customization</h3>
          
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="customCss" className={styles.settingLabel}>
                Custom CSS
              </label>
              <p className={styles.settingDescription}>
                Add custom CSS rules for personalized styling (advanced users only)
              </p>
            </div>
            <textarea
              id="customCss"
              value={settings.customCss || ''}
              onChange={(e) => handleSettingChange('customCss', e.target.value)}
              className={styles.textarea}
              placeholder="/* Add your custom CSS here */"
              rows={6}
              disabled={saving}
            />
          </div>
        </section>
      </div>

      <div className={styles.footer}>
        <p>
          These settings are automatically saved and applied across all your devices.
          If you experience any issues, please contact our support team.
        </p>
      </div>
    </div>
  );
};

export default AccessibilitySettings;