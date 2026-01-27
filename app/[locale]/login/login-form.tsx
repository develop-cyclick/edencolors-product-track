'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n/get-dictionary'

interface LoginFormProps {
  dict: Dictionary
  locale: string
}

export default function LoginForm({ dict, locale }: LoginFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || dict.auth.loginError)
        return
      }

      // Redirect to dashboard
      router.push(`/${locale}/dashboard`)
    } catch {
      setError(dict.common.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 animate-slideDown">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Username Field */}
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-[var(--color-charcoal)] mb-2"
        >
          {dict.auth.username}
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder={locale === 'th' ? 'กรอกชื่อผู้ใช้' : 'Enter username'}
            className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-white border border-[var(--color-beige)] rounded-lg transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[var(--color-charcoal)] mb-2"
        >
          {dict.auth.password}
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={locale === 'th' ? 'กรอกรหัสผ่าน' : 'Enter password'}
            className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-white border border-[var(--color-beige)] rounded-lg transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-4 text-[0.9375rem] font-medium text-white bg-[var(--color-gold)] rounded-lg transition-all duration-200 hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {dict.common.loading}
          </>
        ) : (
          <>
            {dict.auth.loginButton}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </>
        )}
      </button>

      {/* Demo Accounts Hint */}
      <div className="pt-4 border-t border-[var(--color-beige)]">
        <p className="text-xs text-center text-[var(--color-foreground-muted)] mb-3">
          {locale === 'th' ? 'บัญชีทดสอบ (กดเพื่อใส่รหัส):' : 'Test accounts (click to fill):'}
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => { setUsername('admin'); setPassword('admin123') }}
            className="p-2 bg-[var(--color-off-white)] rounded-lg text-center hover:bg-[var(--color-beige)] hover:scale-105 transition-all cursor-pointer"
          >
            <div className="font-medium text-[var(--color-charcoal)]">Admin</div>
            <div className="text-[var(--color-foreground-muted)]">admin</div>
          </button>
          <button
            type="button"
            onClick={() => { setUsername('warehouse1'); setPassword('warehouse123') }}
            className="p-2 bg-[var(--color-off-white)] rounded-lg text-center hover:bg-[var(--color-beige)] hover:scale-105 transition-all cursor-pointer"
          >
            <div className="font-medium text-[var(--color-charcoal)]">Warehouse</div>
            <div className="text-[var(--color-foreground-muted)]">warehouse1</div>
          </button>
          <button
            type="button"
            onClick={() => { setUsername('manager1'); setPassword('manager123') }}
            className="p-2 bg-[var(--color-off-white)] rounded-lg text-center hover:bg-[var(--color-beige)] hover:scale-105 transition-all cursor-pointer"
          >
            <div className="font-medium text-[var(--color-charcoal)]">Manager</div>
            <div className="text-[var(--color-foreground-muted)]">manager1</div>
          </button>
        </div>
      </div>
    </form>
  )
}
