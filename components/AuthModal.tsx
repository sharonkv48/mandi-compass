'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { signInWithMagicLink } = useAuth()

  if (!isOpen) return null

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await signInWithMagicLink(email)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl p-8 w-full max-w-md" 
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Join the Hunt</h2>
        <p className="text-[#5C5148] mb-6">Sign in to save your conquests to the Hall of Fame and unlock persistent achievements.</p>

        <form onSubmit={handleSignIn} className="space-y-4">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[#EDE4D8] rounded-2xl px-4 py-3 text-lg focus:outline-none focus:border-[#B4532A]"
            required
          />
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#B4532A] text-white py-3.5 rounded-2xl font-semibold disabled:opacity-60"
          >
            {loading ? 'Sending magic link...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm text-[#5C5148]">{message}</p>
        )}

        <button 
          onClick={onClose} 
          className="mt-6 w-full text-sm text-[#8A7665]"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}