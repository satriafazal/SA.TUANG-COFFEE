import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { importAdminImageUrl } from '../../../api'
import { isExternalUrl } from '../../../utils/formatters'

interface ImageAdjustModalProps {
  isOpen: boolean
  imageSrc: string
  onClose: () => void
  onApply: (adjustedFile: File, previewUrl: string) => Promise<void> | void
  onSourceImported?: (newSrc: string) => void
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600 // 4:3 standard aspect ratio for product cards

export function ImageAdjustModal({
  isOpen,
  imageSrc,
  onClose,
  onApply,
  onSourceImported,
}: ImageAdjustModalProps) {
  const [currentSrc, setCurrentSrc] = useState(imageSrc)
  const [isImporting, setIsImporting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')

  const imgRef = useRef<HTMLImageElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Load image when currentSrc changes
  useEffect(() => {
    if (!isOpen || !currentSrc) return

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      imgRef.current = img
      setImageLoaded(true)
      setLoadError('')
    }
    img.onerror = () => {
      if (cancelled) return
      setLoadError(
        'Gambar tidak dapat dimuat ke editor (URL eksternal dibatasi CORS oleh server asalnya).',
      )
    }
    img.src = currentSrc

    return () => {
      cancelled = true
    }
  }, [isOpen, currentSrc])

  async function handleImportExternal() {
    setIsImporting(true)
    setLoadError('')
    try {
      const res = await importAdminImageUrl(currentSrc)
      setCurrentSrc(res.path)
      onSourceImported?.(res.path)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal mengimpor gambar ke server.')
    } finally {
      setIsImporting(false)
    }
  }

  // Draw real-time preview canvas
  useEffect(() => {
    if (!isOpen || !imageLoaded || !imgRef.current || !previewCanvasRef.current) return

    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = imgRef.current
    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)
    ctx.save()

    // Filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`

    // Center & transform
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom, zoom)

    // Calculate dimensions to cover viewport
    const imgRatio = img.naturalWidth / img.naturalHeight
    const canvasRatio = w / h
    let drawW = w
    let drawH = h

    if (imgRatio > canvasRatio) {
      drawH = h
      drawW = h * imgRatio
    } else {
      drawW = w
      drawH = w / imgRatio
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }, [isOpen, imageLoaded, zoom, rotation, brightness, contrast, pan])

  if (!isOpen) return null

  // Pointer drag events for panning
  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.1 : -0.1
    setZoom((prev) => Math.min(3, Math.max(0.8, Number((prev + delta).toFixed(2)))))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setBrightness(100)
    setContrast(100)
    setPan({ x: 0, y: 0 })
  }

  const handleSave = async () => {
    if (!imgRef.current) return
    setSaving(true)

    try {
      // Create offscreen canvas for high-quality export
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = CANVAS_WIDTH
      exportCanvas.height = CANVAS_HEIGHT
      const ctx = exportCanvas.getContext('2d')

      if (!ctx) throw new Error('Canvas context tidak tersedia')

      const img = imgRef.current
      const w = CANVAS_WIDTH
      const h = CANVAS_HEIGHT

      // Scale factor relative to the preview canvas
      const previewW = previewCanvasRef.current?.width || 400
      const scaleMultiplier = CANVAS_WIDTH / previewW

      ctx.save()
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
      ctx.translate(w / 2 + pan.x * scaleMultiplier, h / 2 + pan.y * scaleMultiplier)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(zoom, zoom)

      const imgRatio = img.naturalWidth / img.naturalHeight
      const canvasRatio = w / h
      let drawW = w
      let drawH = h

      if (imgRatio > canvasRatio) {
        drawH = h
        drawW = h * imgRatio
      } else {
        drawW = w
        drawH = w / imgRatio
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()

      // Export to blob
      exportCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            setSaving(false)
            setLoadError('Gagal memproses gambar.')
            return
          }

          const file = new File([blob], `product-${Date.now()}.webp`, {
            type: 'image/webp',
          })
          const previewUrl = URL.createObjectURL(blob)

          try {
            await onApply(file, previewUrl)
            onClose()
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Gagal menyimpan penyesuaian.')
          } finally {
            setSaving(false)
          }
        },
        'image/webp',
        0.9,
      )
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Gambar dari URL eksternal mungkin dibatasi keamanan CORS.',
      )
      setSaving(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <section
        className="admin-modal admin-adjust-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-adjust-title"
      >
        <div className="admin-modal-head">
          <div>
            <span className="admin-kicker">EDITOR GAMBAR</span>
            <h2 id="image-adjust-title">Sesuaikan & Potong Gambar</h2>
          </div>
          <button
            type="button"
            className="admin-close"
            disabled={saving}
            onClick={onClose}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="admin-adjust-body">
          {/* Viewport canvas */}
          <div className="admin-crop-viewport-wrapper">
            <div className="admin-crop-viewport">
              <canvas
                ref={previewCanvasRef}
                width={400}
                height={300}
                className="admin-crop-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              />
              <div className="admin-crop-grid" aria-hidden="true">
                <span className="grid-h1" />
                <span className="grid-h2" />
                <span className="grid-v1" />
                <span className="grid-v2" />
              </div>
            </div>
            <div className="admin-crop-hint">
              <span>💡 Geser / Drag untuk atur posisi · Scroll untuk perbesar</span>
            </div>
          </div>

          {loadError && (
            <div className="admin-adjust-error-card" style={{ marginBottom: '14px', background: '#fff5f5', border: '1px solid #fed7d7', padding: '12px', borderRadius: '4px' }}>
              <p className="admin-alert error" role="alert" style={{ margin: '0 0 8px', fontSize: '11px', color: '#c53030' }}>
                {loadError}
              </p>
              {isExternalUrl(currentSrc) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    className="admin-button primary compact"
                    disabled={isImporting}
                    onClick={handleImportExternal}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {isImporting ? 'Mengunduh ke Server…' : '📥 Impor Otomatis ke Server Lokal (Bebas CORS)'}
                  </button>
                  <small style={{ color: '#4a5568', fontSize: '10px' }}>
                    Sistem akan mengunduh gambar ini ke penyimpanan server lokal toko sehingga dapat diedit secara bebas.
                  </small>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="admin-crop-controls">
            <div className="admin-control-row">
              <label>
                <span>🔍 Perbesar (Zoom): {zoom.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>

              <label>
                <span>☀️ Kecerahan: {brightness}%</span>
                <input
                  type="range"
                  min="70"
                  max="140"
                  step="5"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                />
              </label>

              <label>
                <span>🌓 Kontras: {contrast}%</span>
                <input
                  type="range"
                  min="70"
                  max="140"
                  step="5"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="admin-control-tools">
              <button
                type="button"
                className="admin-button quiet"
                onClick={handleRotate}
                title="Putar 90 derajat searah jarum jam"
              >
                <span>↺</span> Putar 90° ({rotation}°)
              </button>
              <button
                type="button"
                className="admin-button quiet"
                onClick={handleReset}
                title="Kembalikan ke posisi awal"
              >
                <span>⟲</span> Reset
              </button>
            </div>
          </div>
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-button quiet"
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="admin-button primary"
            disabled={saving || !imageLoaded}
            onClick={handleSave}
          >
            {saving ? 'Memproses & Menyimpan…' : 'Terapkan Penyesuaian'}
          </button>
        </div>
      </section>
    </div>
  )
}
