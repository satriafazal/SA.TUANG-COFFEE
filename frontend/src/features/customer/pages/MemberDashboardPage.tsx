import type { PrototypeMember, PrototypeOrder } from '../../../state/prototypeState'
import type { Screen } from '../components/CustomerHeader'

interface MemberDashboardPageProps {
  currentMember: PrototypeMember
  currentOrders: PrototypeOrder[]
  moveTo: (screen: Screen) => void
}

export function MemberDashboardPage({
  currentMember,
  currentOrders,
  moveTo,
}: MemberDashboardPageProps) {
  return (
    <section className="member-page">
      <div className="member-welcome">
        <div>
          <span className="eyebrow">RUANG MEMBER</span>
          <h1>Halo, {currentMember.name.split(' ')[0]}.</h1>
          <p>Pesanan dan poin loyalitasmu, tersimpan di satu tempat.</p>
        </div>
        <div className="member-badge">
          SA.TUANG
          <br />
          <small>MEMBER</small>
        </div>
      </div>

      <div className="member-dashboard-grid">
        <article className="points-card">
          <div className="points-card-head">
            <span className="eyebrow light">SALDO POIN</span>
          </div>
          <strong>
            {currentMember.points.toLocaleString('id-ID')}
            <small> poin</small>
          </strong>
          <p>
            Poin diperoleh setelah pesanan selesai. Aturan penukaran nominal akan
            diatur Admin.
          </p>
          <button
            className="button button-outline-light"
            onClick={() => moveTo('member-points')}
          >
            Lihat detail poin <span>↗</span>
          </button>
        </article>

        <article className="member-action-card">
          <span className="eyebrow">MULAI PESAN</span>
          <h2>Temukan teman jedamu.</h2>
          <p>
            Pilih menu, lihat ringkasan, lalu pesan untuk diambil di Banjar
            Wijaya.
          </p>
          <button
            className="button button-accent"
            onClick={() => moveTo('order-menu')}
          >
            Lihat menu <span>↗</span>
          </button>
        </article>

        <article className="member-history-card">
          <div>
            <span className="eyebrow">AKUN MEMBER</span>
            <h2>Pesanan dan akunmu</h2>
            <p>
              {currentOrders.length
                ? `${currentOrders.length} pesanan tersimpan`
                : 'Pesanan yang kamu buat akan tersimpan di sini.'}
            </p>
          </div>
          <div className="member-history-actions">
            <button
              className="button button-dark"
              onClick={() => moveTo('orders')}
            >
              Pesanan saya
            </button>
            <span>{currentMember.email}</span>
          </div>
        </article>
      </div>
    </section>
  )
}
