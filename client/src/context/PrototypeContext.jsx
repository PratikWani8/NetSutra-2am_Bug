import React, { createContext, useContext, useState } from 'react';

const PrototypeContext = createContext(null);

export const VIEW_STATES = {
  NORMAL: 'Normal View',
  SKELETON: 'Skeleton',
  EMPTY: 'Empty State',
  ERROR: 'API Error',
  DISCONNECTED: 'Simulate Disconnect',
};

export const PrototypeProvider = ({ children }) => {
  const [viewState, setViewState] = useState(VIEW_STATES.NORMAL);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDemoDataActive, setIsDemoDataActive] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  return (
    <PrototypeContext.Provider
      value={{
        viewState,
        setViewState,
        isDarkMode,
        toggleDarkMode,
        isDemoDataActive,
        setIsDemoDataActive,
        VIEW_STATES,
      }}
    >
      {children}
    </PrototypeContext.Provider>
  );
};

export const usePrototype = () => {
  const context = useContext(PrototypeContext);
  if (!context) {
    throw new Error('usePrototype must be used within a PrototypeProvider');
  }
  return context;
};
