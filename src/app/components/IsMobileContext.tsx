"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;
export const LIGHT_VISUAL_EFFECTS_QUERY =
  "(max-width: 1180px), (hover: none), (pointer: coarse), (any-pointer: coarse)";

const IsMobileContext = createContext<boolean>(false);
const IsTouchLikeContext = createContext<boolean>(true);

export function useIsMobileContext(): boolean {
  return useContext(IsMobileContext);
}

export function useIsTouchLikeContext(): boolean {
  return useContext(IsTouchLikeContext);
}

export function IsMobileProvider({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchLike, setIsTouchLike] = useState(true);

  useEffect(() => {
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const lightEffectsMq = window.matchMedia(LIGHT_VISUAL_EFFECTS_QUERY);

    const update = () => {
      setIsMobile(mobileMq.matches);
      setIsTouchLike(lightEffectsMq.matches);
    };

    update();
    mobileMq.addEventListener("change", update);
    lightEffectsMq.addEventListener("change", update);
    return () => {
      mobileMq.removeEventListener("change", update);
      lightEffectsMq.removeEventListener("change", update);
    };
  }, []);

  return (
    <IsMobileContext.Provider value={isMobile}>
      <IsTouchLikeContext.Provider value={isTouchLike}>
        {children}
      </IsTouchLikeContext.Provider>
    </IsMobileContext.Provider>
  );
}
