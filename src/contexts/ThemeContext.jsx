import { createContext, useContext, useState } from 'react';

const ThemeCtx = createContext({ isDark: false, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('labstock-theme');
    const dark = saved === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    return dark;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      localStorage.setItem('labstock-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeCtx.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
