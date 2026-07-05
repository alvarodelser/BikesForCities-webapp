import { createContext, useContext } from 'react';

interface RevealContextValue {
  revealed: boolean;
}

export const RevealContext = createContext<RevealContextValue>({ revealed: true });

export function useReveal(): RevealContextValue {
  return useContext(RevealContext);
}
