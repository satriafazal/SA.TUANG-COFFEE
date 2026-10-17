import type { FormEvent } from 'react'
import type { Screen } from '../components/CustomerHeader'

interface CustomerAuthPageProps {
  screen: 'login' | 'register'
  authName: string
  setAuthName: (val: string) => void
  authEmail: string
  setAuthEmail: (val: string) => void
  authPassword: string
  setAuthPassword: (val: string) => void
  authConfirm: string
  setAuthConfirm: (val: string) => void
  authError: string
  setAuthError: (val: string) => void
  authNotice: string
  setAuthNotice: (val: string) => void
  submitLogin: (event: FormEvent<HTMLFormElement>) => void
  submitRegister: (event: FormEvent<HTMLFormElement>) => void
  passwordResetNotice: () => void
  moveTo: (screen: Screen) => void
}

export function CustomerAuthPage({
  screen,
  authName,
  setAuthName,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authConfirm,
  setAuthConfirm,
  authError,
  setAuthError,
  authNotice,
  setAuthNotice,
  submitLogin,
  submitRegister,
  passwordResetNotice,
  moveTo,
}: CustomerAuthPageProps) {
  return (
    <section className="auth-page">
      <div className="auth-aside">
        <span className="eyebrow">SA.TUANG MEMBER</span>
        <h1>
          {screen === 'login'
            ? 'Senang melihatmu kembali.'
            : 'Mulai jadi bagian dari SA.TUANG.'}
        </h1>
        <p>
          {screen === 'login'
            ? 'Masuk untuk melihat profil, pesanan, dan poin loyalitasmu.'
            : 'Buat akun Member untuk menyimpan riwayat dan menikmati fitur loyalitas.'}
        </p>
        <div className="auth-points">
          <span>01</span>
          <span>Riwayat pesanan tersimpan</span>
          <span>02</span>
          <span>Informasi poin Member</span>
        </div>
      </div>

      <form
        className="customer-form auth-form"
        onSubmit={screen === 'login' ? submitLogin : submitRegister}
      >
        <div className="form-title">
          <span className="eyebrow">
            {screen === 'login' ? 'MASUK MEMBER' : 'DAFTAR MEMBER'}
          </span>
          <h2>{screen === 'login' ? 'Masuk' : 'Buat akun'}</h2>
        </div>

        {screen === 'register' && (
          <label>
            Nama lengkap
            <input
              autoComplete="name"
              required
              maxLength={120}
              value={authName}
              onChange={(event) => setAuthName(event.target.value)}
              placeholder="Nama kamu"
            />
          </label>
        )}

        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            required
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="nama@email.com"
          />
        </label>

        <label>
          Kata sandi
          <input
            autoComplete={screen === 'login' ? 'current-password' : 'new-password'}
            type="password"
            minLength={screen === 'register' ? 8 : 1}
            required
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="Minimal 8 karakter"
          />
        </label>

        {screen === 'register' && (
          <label>
            Ulangi kata sandi
            <input
              autoComplete="new-password"
              type="password"
              minLength={8}
              required
              value={authConfirm}
              onChange={(event) => setAuthConfirm(event.target.value)}
              placeholder="Ulangi kata sandi"
            />
          </label>
        )}

        {authError && (
          <p className="form-error" role="alert">
            {authError}
          </p>
        )}

        {authNotice && (
          <p className="form-notice" role="status">
            {authNotice}
          </p>
        )}

        <button className="button button-accent full" type="submit">
          {screen === 'login' ? 'Masuk ke akun' : 'Daftar Member'}
        </button>

        {screen === 'login' && (
          <button
            className="text-button"
            type="button"
            onClick={passwordResetNotice}
          >
            Lupa kata sandi?
          </button>
        )}

        <p className="auth-switch">
          {screen === 'login' ? 'Belum menjadi Member?' : 'Sudah punya akun?'}{' '}
          <button
            className="text-button inline-button"
            type="button"
            onClick={() => {
              setAuthError('')
              setAuthNotice('')
              moveTo(screen === 'login' ? 'register' : 'login')
            }}
          >
            {screen === 'login' ? 'Daftar' : 'Masuk'}
          </button>
        </p>

        <button
          className="back-link"
          type="button"
          onClick={() => moveTo('identity')}
        >
          ← Kembali pilih Guest atau Member
        </button>
      </form>
    </section>
  )
}
