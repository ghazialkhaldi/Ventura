import { useState, useEffect } from 'react'

const KEY = 'sf_data_ready'

export function useDataReady() {
  const [isReady, setIsReady] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const flagSet = localStorage.getItem(KEY) === 'true'
      // Guard against a stale flag with no real dataset
      if (flagSet && !localStorage.getItem('sf_dataset')) {
        localStorage.removeItem(KEY)
        setIsReady(false)
      } else {
        setIsReady(flagSet)
      }
    } catch {}
    setMounted(true)
  }, [])

  function markReady() {
    try { localStorage.setItem(KEY, 'true') } catch {}
    setIsReady(true)
  }

  function clearReady() {
    try { localStorage.removeItem(KEY) } catch {}
    setIsReady(false)
  }

  return { isReady, mounted, markReady, clearReady }
}
