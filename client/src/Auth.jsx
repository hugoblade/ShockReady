import { useState } from 'react'
import { supabase } from './supabase'
import './Auth.css'


export default function Auth({ onBack }) {
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        })

        if (error) throw error

        if (data.session) {
          setMessage('Account created successfully. You can now continue to ShockReady.')
        } else {
          setMessage('Account request received. Check your email to confirm your account before signing in.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error

        setMessage('Signed in successfully. Your authentication session is active.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <button className="auth-back" type="button" onClick={onBack}>
        ← Back to ShockReady
      </button>

      <section className="auth-card">
        <div className="auth-brand">Shock<span>Ready</span></div>
        <p className="auth-kicker">COMMUNITY-POWERED CLIMATE RESILIENCE</p>

        <h1>{mode === 'login' ? 'Welcome back.' : 'Join your community.'}</h1>
        <p className="auth-description">
          {mode === 'login'
            ? 'Sign in to continue your work towards a more resilient community.'
            : 'Create an account to take part in community climate action.'}
        </p>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setMessage(''); setError('') }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setMessage(''); setError('') }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>
              Full name
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>

          {error && <p className="auth-message auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message auth-success" role="status">{message}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <p className="auth-footnote">
          Your account access is managed securely through Supabase.
        </p>
      </section>
    </main>
  )
}
