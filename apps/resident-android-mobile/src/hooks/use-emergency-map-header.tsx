import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

const EmergencyMapHeaderContext = createContext({ active: false, setActive: (_active: boolean) => {}, searchAvoidance: false, setSearchAvoidance: (_avoiding: boolean) => {} });

/** Limits the header's idle-collapse behavior to searches opened from Centers → Map. */
export function EmergencyMapHeaderProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [searchAvoidance, setSearchAvoidance] = useState(false);
  const value = useMemo(() => ({ active, setActive, searchAvoidance, setSearchAvoidance }), [active, searchAvoidance]);
  return <EmergencyMapHeaderContext.Provider value={value}>{children}</EmergencyMapHeaderContext.Provider>;
}

export const useEmergencyMapHeader = () => useContext(EmergencyMapHeaderContext);
