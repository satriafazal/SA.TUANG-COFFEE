interface GuestOfferModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: () => void
  onContinueGuest: () => void
}

export function GuestOfferModal({
  isOpen,
  onClose,
  onRegister,
  onContinueGuest,
}: GuestOfferModalProps) {
  if (!isOpen) return null

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
        <span className="eyebrow">SEBELUM MELANJUTKAN</span>
        <h2 id="guest-offer-title">
          Ingin bergabung
          <br />
          <em>jadi Member?</em>
        </h2>
        <p>
          Member memiliki area akun, riwayat, dan fitur poin. Kamu tetap bisa
          memesan tanpa akun.
        </p>
        <div className="choice-modal-actions">
          <button
            className="button button-outline full"
            onClick={onRegister}
          >
            Daftar Member
          </button>
          <button
            className="button button-accent full"
            onClick={onContinueGuest}
          >
            Tidak, lanjut sebagai Guest
          </button>
        </div>
      </section>
    </div>
  )
}
