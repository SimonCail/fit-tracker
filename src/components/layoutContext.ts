import { createContext, useContext } from 'react'

export type LayoutActions = {
  openSettings: () => void
  openNewSession: () => void
}

export const LayoutCtx = createContext<LayoutActions>({
  openSettings: () => {},
  openNewSession: () => {},
})

export function useLayout() {
  return useContext(LayoutCtx)
}