import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ef_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ef_theme', theme);
    } catch (e) {
      // ignore
    }
    // apply theme class at the root so CSS can react globally
    const el = document.documentElement || document.body;
    el.classList.toggle('theme-dark', theme === 'dark');
    el.classList.toggle('theme-light', theme === 'light');
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
