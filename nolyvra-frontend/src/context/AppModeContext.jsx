import { createContext, useContext, useState } from "react";

const AppModeContext = createContext({ mode: "recruit", setMode: () => {} });

export function AppModeProvider({ children }) {
  const [mode, setMode] = useState("recruit");
  return (
    <AppModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
