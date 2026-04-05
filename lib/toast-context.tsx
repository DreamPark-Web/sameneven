'use client'

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

export type ToastVariant = 'success' | 'warning' | 'danger'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  action?: ToastAction
}

interface ToastContextValue {
  addToast: (opts: { message: string; variant: ToastVariant; action?: ToastAction; duration?: number }) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const BORDER_COLOR: Record<ToastVariant, string> = {
  success: '#10B981',
  warning: '#F59E0B',
  danger:  '#EF4444',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
  }, [])

  const addToast = useCallback((opts: {
    message: string
    variant: ToastVariant
    action?: ToastAction
    duration?: number
  }): string => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message: opts.message, variant: opts.variant, action: opts.action }])
    const duration = opts.duration ?? 3000
    const timer = setTimeout(() => removeToast(id), duration)
    timers.current.set(id, timer)
    return id
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: 'var(--s3)',
              color: '#F9FAFB',
              borderLeft: `4px solid ${BORDER_COLOR[t.variant]}`,
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              maxWidth: 340,
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
              animation: 'toastIn .18s ease',
            }}
          >
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            {t.action && (
              <button
                onClick={t.action.onClick}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#F9FAFB',
                  borderRadius: 5,
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
