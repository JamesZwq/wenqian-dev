"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

const IsMobileContext = createContext<boolean>(false);

export function useIsMobileContext(): boolean {
  return useContext(IsMobileContext);
}

export function IsMobileProvider({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <IsMobileContext.Provider value={isMobile}>
      {children}
    </IsMobileContext.Provider>
  );
}
