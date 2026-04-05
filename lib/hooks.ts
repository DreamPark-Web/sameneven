'use client'

import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return {
    isSmall: width < 900,
    isMedium: width >= 900 && width < 1280,
    isLarge: width >= 1280,
    isMobile: width < 480,
    isXSmall: width < 380,
    width,
  }
}
