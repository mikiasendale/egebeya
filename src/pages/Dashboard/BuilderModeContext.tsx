import React, { createContext, useContext, useState, useCallback } from 'react';

export type BuilderMode = 'puck' | 'code';

interface BuilderModeContextValue {
  mode: BuilderMode;
  setMode: (mode: BuilderMode) => void;
}

const BuilderModeContext = createContext<BuilderModeContextValue>({
  mode: 'puck',
  setMode: () => {},
});

export function BuilderModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<BuilderMode>('puck');
  const value = { mode, setMode };
  return (
    <BuilderModeContext.Provider value={value}>
      {children}
    </BuilderModeContext.Provider>
  );
}

export function useBuilderMode() {
  return useContext(BuilderModeContext);
}
