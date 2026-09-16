import { createContext, useContext } from 'react'

export const FeatureFlagsContext = createContext(null)

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext)
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider')
  }
  return context
}
