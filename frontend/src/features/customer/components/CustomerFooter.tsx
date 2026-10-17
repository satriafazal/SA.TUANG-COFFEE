import type { Screen } from './CustomerHeader'

interface CustomerFooterProps {
  screen: Screen
  moveTo: (screen: Screen) => void
}

export function CustomerFooter({ screen, moveTo }: CustomerFooterProps) {
  if (screen === 'landing') {
    return (
      <footer className="site-footer customer-footer">
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark">S</span>
          <span className="brand-copy">
            <strong>SA.TUANG</strong>
            <small>COFFEE · BANJAR WIJAYA</small>
          </span>
        </a>
        <span>Ruang untuk berhenti sebentar.</span>
        <small>© SA.TUANG COFFEE</small>
      </footer>
    )
  }

  return (
    <footer className="customer-footer-simple">
      <button onClick={() => moveTo('landing')}>
        SA.TUANG COFFEE · Informasi outlet
      </button>
      <span>© SA.TUANG COFFEE · BANJAR WIJAYA</span>
    </footer>
  )
}
