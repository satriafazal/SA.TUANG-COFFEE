import type { PrototypeMember } from '../../../state/prototypeState'
import type { Screen } from '../components/CustomerHeader'

interface MemberPointsPageProps {
  currentMember: PrototypeMember
  moveTo: (screen: Screen) => void
}

export function MemberPointsPage({
  currentMember,
  moveTo,
}: MemberPointsPageProps) {
  return (
    <section className="points-page">
      <div className="flow-heading">
        <span className="eyebrow">AREA MEMBER · POIN LOYALITAS</span>
        <h1>
          Poin yang
          <br />
          <em>terkumpul.</em>
        </h1>
        <p>Pantau perolehan dan penggunaan poin loyalitasmu di sini.</p>
      </div>

      <article className="points-summary">
        <span className="eyebrow">SALDO POIN SAAT INI</span>
        <strong>{currentMember.points.toLocaleString('id-ID')} poin</strong>
        <p>
          Poin baru diberikan setelah pesanan berstatus SELESAI. Penukaran poin
          menjadi potongan nominal menunggu aturan Admin.
        </p>
        <div className="points-empty">
          <span>✳</span>
          <div>
            <b>Belum ada riwayat poin</b>
            <small>
              Riwayat perolehan, pemakaian, dan pengembalian akan mengikuti ledger
              setelah integrasi.
            </small>
          </div>
        </div>
      </article>

      <button
        className="back-link"
        onClick={() => {
          moveTo('member-home')
        }}
      >
        ← Kembali ke Dashboard Member
      </button>
    </section>
  )
}
