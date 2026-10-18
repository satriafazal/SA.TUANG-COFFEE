import type { Screen } from '../components/CustomerHeader'

interface IdentityChoicePageProps {
  chooseMember: () => void
  setGuestOfferOpen: (open: boolean) => void
  moveTo: (screen: Screen) => void
}

export function IdentityChoicePage({
  chooseMember,
  setGuestOfferOpen,
  moveTo,
}: IdentityChoicePageProps) {
  return (
    <section className="flow-page">
      <div className="flow-heading">
        <span className="eyebrow">LANGKAH 01 — PILIH CARA MEMESAN</span>
        <h1>
          Selamat datang
          <br />
          <em>di SA.TUANG.</em>
        </h1>
        <p>
          Pilih pengalaman yang sesuai. Member mendapat akses ke akun dan fitur
          loyalitas.
        </p>
      </div>

      <div className="identity-grid">
        <article className="identity-card member-choice">
          <div className="choice-mark">M</div>
          <span className="eyebrow">PUNYA AKUN MEMBER?</span>
          <h2>
            Masuk sebagai
            <br />
            Member
          </h2>
          <p>Lihat riwayat pesanan dan poin loyalitas dalam satu tempat.</p>
          <div className="choice-actions">
            <button
              className="button button-dark full"
              onClick={chooseMember}
            >
              Masuk Member
            </button>
            <button
              className="text-button"
              onClick={() => moveTo('register')}
            >
              Daftar Member
            </button>
          </div>
        </article>

        <article className="identity-card guest-choice">
          <div className="choice-mark guest-mark">G</div>
          <span className="eyebrow">BELUM PUNYA AKUN?</span>
          <h2>
            Pesan sebagai
            <br />
            Guest
          </h2>
          <p>
            Tidak perlu membuat akun. Jika berubah pikiran, kamu bisa daftar
            Member sebelum melanjutkan.
          </p>
          <button
            className="button button-accent full"
            onClick={() => setGuestOfferOpen(true)}
          >
            Pilih Guest <span>↗</span>
          </button>
        </article>
      </div>

      <button className="back-link" onClick={() => moveTo('landing')}>
        ← Kembali ke informasi SA.TUANG
      </button>
      <button
        className="text-button recovery-entry"
        onClick={() => moveTo('recovery')}
      >
        Lupa kode antrean?
      </button>
    </section>
  )
}

