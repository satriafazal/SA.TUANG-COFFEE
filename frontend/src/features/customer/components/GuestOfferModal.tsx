import { useState, useEffect, type FormEvent } from 'react'

interface GuestOfferModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: () => void
  onLogin?: () => void
  onConfirmGuestName: (name: string) => void
  initialGuestName?: string
}

export function GuestOfferModal({
  isOpen,
  onClose,
  onRegister,
  onLogin,
  onConfirmGuestName,
  initialGuestName = '',
}: GuestOfferModalProps) {
  const [step, setStep] = useState<'offer' | 'name_input'>('offer')
  const [guestName, setGuestName] = useState(initialGuestName)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setStep('offer')
      setNameError('')
      if (initialGuestName) setGuestName(initialGuestName)
    }
  }, [isOpen, initialGuestName])

  if (!isOpen) return null

  const handleGuestSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = guestName.trim()
    if (!trimmed) {
      setNameError('Silakan masukkan nama panggilan terlebih dahulu.')
      return
    }
    setNameError('')
    onConfirmGuestName(trimmed)
  }

  return (
    <div
      className="overlay choice-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-offer-title"
      >
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Tutup pilihan"
        >
          ×
        </button>

        {step === 'offer' ? (
          <>
            <span className="eyebrow">SEBELUM MELANJUTKAN</span>
            <h2 id="guest-offer-title">
              Ingin memesan
              <br />
              <em>sebagai apa?</em>
            </h2>
            <p>
              Member memiliki akses riwayat pesanan dan poin loyalitas. Kamu juga
              tetap bisa memesan langsung tanpa akun (Guest).
            </p>
            <div className="choice-modal-actions">
              {onLogin && (
                <button
                  type="button"
                  className="button button-dark full"
                  onClick={onLogin}
                >
                  Masuk Akun Member
                </button>
              )}
              <button
                type="button"
                className="button button-outline full"
                onClick={onRegister}
              >
                Daftar Member Baru
              </button>
              <button
                type="button"
                className="button button-accent full"
                onClick={() => setStep('name_input')}
              >
                Lanjut sebagai Guest <span>↗</span>
              </button>
            </div>
          </>
        ) : (
          <form className="guest-modal-form" onSubmit={handleGuestSubmit}>
            <span className="eyebrow">IDENTIFIKASI GUEST</span>
            <h2 id="guest-offer-title">
              Siapa nama
              <br />
              <em>panggilanmu?</em>
            </h2>
            <p className="guest-modal-subtitle">
              Nama ini akan digunakan untuk identifikasi pesanan di bar dan untuk pembayaran cash
            </p>
            <div className="guest-modal-field">
              <input
                type="text"
                className="guest-name-input"
                placeholder="Contoh: Budi, Sarah"
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value)
                  if (nameError) setNameError('')
                }}
                autoFocus
                maxLength={60}
              />
              {nameError && <div className="guest-input-error">{nameError}</div>}
            </div>
            <div className="choice-modal-actions">
              <button type="submit" className="button button-accent full">
                Lanjut ke Menu <span>↗</span>
              </button>
              <button
                type="button"
                className="text-button"
                style={{ textAlign: 'center', marginTop: '6px' }}
                onClick={() => {
                  setStep('offer')
                  setNameError('')
                }}
              >
                ← Kembali ke penawaran member
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

