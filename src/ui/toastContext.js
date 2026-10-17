import { createContext, useContext } from 'react'

export const ToastContext = createContext({ push: () => {} })

// Usage: const toast = useToast(); toast('Saved'); toast('Something failed', 'error')
export const useToast = () => useContext(ToastContext).push
