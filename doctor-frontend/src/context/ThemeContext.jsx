/*
 * ThemeContext.jsx — Stub retained for backwards-compat imports.
 * The three-mode dark/light/3d theme system has been removed.
 * Components that imported useThemeContext will receive a no-op context
 * so they don't crash, but should be updated to use design-tokens.css vars.
 */
import React, { createContext, useContext } from 'react';

const ThemeContext = createContext({ theme: 'light' });

export const useThemeContext = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ theme: 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
