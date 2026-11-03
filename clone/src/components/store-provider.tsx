"use client";

import { createContext, useContext } from "react";

const StoreCtx = createContext<{ slug: string; name: string }>({ slug: "", name: "" });

export function StoreProvider({ slug, name, children }: { slug: string; name: string; children: React.ReactNode }) {
  return <StoreCtx.Provider value={{ slug, name }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  return useContext(StoreCtx);
}
