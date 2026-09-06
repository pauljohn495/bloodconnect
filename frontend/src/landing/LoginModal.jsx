import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api.js'
import { Icon, Modal } from './shared.jsx'

export default function LoginModal({ onClose, canRegister }) {
  const navigate = useNavigate()
  const [role, setRole] = useState('donor')
  const [donorIdMode, setDonorIdMode] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const googleButtonRef = useRef(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const isDonorId = role === 'donor' && donorIdMode

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password, role, loginMode: isDonorId ? 'id' : 'default' }),
      })
      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.user.role)
      navigate(data.user.role === 'hospital' ? '/hospital/inventory' : ['admin', 'super_admin'].includes(data.user.role) ? '/admin/dashboard' : '/dashboard')
    } catch (err) { setError(err.message || 'Login failed') }
    finally { setBusy(false) }
  }

  const googleLogin = useCallback(async credential => {
    setGoogleError('')
    setError('')
    setBusy(true)
    try {
      const data = await apiRequest('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential, role: 'donor' }) })
      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.user.role)
      navigate(data.user.role === 'donor' && data.needsDonorProfileSetup ? '/complete-google-donor-profile' : '/dashboard')
    } catch (err) { setGoogleError(err.message || 'Google login failed') }
    finally { setBusy(false) }
  }, [navigate])

  useEffect(() => {
    if (role !== 'donor' || !googleClientId) return
    let cancelled = false
    const initialize = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: response => {
        if (cancelled) return
        if (response?.credential) googleLogin(response.credential)
        else setGoogleError('Google sign-in failed. Please try again.')
      } })
      googleButtonRef.current.replaceChildren()
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline', size: 'large', width: Math.min(320, googleButtonRef.current.clientWidth || 280), text: 'continue_with', shape: 'pill',
      })
    }
    const failed = () => { if (!cancelled) setGoogleError('Google sign-in is unavailable. Please use your account details.') }
    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    initialize()
    script?.addEventListener('load', initialize)
    script?.addEventListener('error', failed)
    return () => { cancelled = true; script?.removeEventListener('load', initialize); script?.removeEventListener('error', failed) }
  }, [role, googleClientId, googleLogin])

  return <Modal title="Good to have you back." eyebrow="YOUR BLOODCONNECT PORTAL" onClose={onClose}>
    <p className="bc-modal-intro">Sign in to stay connected and keep making a difference.</p>
    <div className="bc-toggle bc-role-toggle" aria-label="Account type">{['donor', 'hospital', 'admin'].map(item => <button key={item} disabled={busy} aria-pressed={role === item} onClick={() => { setRole(item); setDonorIdMode(false); setError(''); setGoogleError('') }}>{item}</button>)}</div>
    <form onSubmit={submit} className="bc-login-form">
      <label htmlFor="bc-identifier">{isDonorId ? 'Donor ID' : 'Username or email'}<input id="bc-identifier" required disabled={busy} value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete={isDonorId ? 'off' : 'username'} placeholder={isDonorId ? 'e.g. BC-12345' : 'Enter your username or email'} /></label>
      {!isDonorId && <label htmlFor="bc-password">Password<input id="bc-password" required disabled={busy} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" /></label>}
      {role === 'donor' && <button type="button" className="bc-text-link" disabled={busy} onClick={() => { setDonorIdMode(value => !value); setError('') }}>{isDonorId ? 'Use username / email instead' : 'Use donor ID instead'}</button>}
      {error && <p className="bc-form-error" role="alert">{error}</p>}
      <button disabled={busy} className="bc-button bc-button-primary bc-full-width">{busy ? 'Signing in…' : `Sign in as ${role}`}<Icon name="arrow" /></button>
    </form>
    {role === 'donor' && <div className="bc-google-login"><div className="bc-divider-label">or continue with</div>{googleClientId ? <div ref={googleButtonRef} className={busy ? 'bc-google-busy' : ''} /> : <p className="bc-login-note">Google sign-in is currently unavailable.</p>}{googleError && <p className="bc-form-error" role="alert">{googleError}</p>}</div>}
    {canRegister && <p className="bc-login-register">New to BloodConnect? <button className="bc-text-link" onClick={() => navigate('/register')}>Create an account</button></p>}
  </Modal>
}
