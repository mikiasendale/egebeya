import React, { createContext, useContext, useState, useCallback } from 'react';

export type BuilderMode = 'visual' | 'code';

interface BuilderModeContextValue {
  mode: BuilderMode;
  setMode: (mode: BuilderMode) => void;
}

const BuilderModeContext = createContext<BuilderModeContextValue>({
  mode: 'visual',
  setMode: () => {},
});

export function BuilderModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<BuilderMode>('visual');
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
