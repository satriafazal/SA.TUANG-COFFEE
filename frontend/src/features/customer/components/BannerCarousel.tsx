import { useEffect, useRef, useState } from 'react'
import type { CustomerBanner } from '../../../types'

function resolveBannerImage(banner: CustomerBanner): string | null {
  if (banner.image_path && banner.image_path.trim().length > 0) {
    return banner.image_path.trim()
  }
  if (
    banner.link_url &&
    (banner.link_url.includes('images.unsplash.com') ||
      banner.link_url.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i))
  ) {
    return banner.link_url.trim()
  }
  return null
}

function resolveBannerActionLink(banner: CustomerBanner): string | null {
  if (
    banner.link_url &&
    (banner.link_url.includes('images.unsplash.com') ||
      banner.link_url.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i)) &&
    !banner.image_path
  ) {
    return null
  }
  return banner.link_url ? banner.link_url.trim() : null
}

function getVisibleCount(): number {
  if (typeof window === 'undefined') return 3
  if (window.innerWidth >= 1024) return 3
  if (window.innerWidth >= 641) return 2
  return 1
}

export function BannerCarousel({
  banners,
  onActionClick,
}: {
  banners: CustomerBanner[]
  onActionClick?: (link: string) => void
}) {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [visibleCount, setVisibleCount] = useState<number>(getVisibleCount)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const handleResize = () => setVisibleCount(getVisibleCount())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const gap = visibleCount === 3 ? 20 : visibleCount === 2 ? 16 : 14
  const maxIndex = Math.max(0, banners.length - visibleCount)

  const activeIndex = Math.min(current, maxIndex)

  useEffect(() => {
    if (!banners.length || maxIndex === 0 || isPaused) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev >= maxIndex ? 0 : prev + 1))
    }, 5000)
    return () => clearInterval(timer)
  }, [banners.length, maxIndex, isPaused])

  if (!banners.length) return null

  const handlePrev = () => {
    setCurrent((prev) => (prev <= 0 ? maxIndex : Math.min(prev - 1, maxIndex)))
  }

  const handleNext = () => {
    setCurrent((prev) => (prev >= maxIndex ? 0 : prev + 1))
  }

  const translateFormula =
    maxIndex === 0
      ? '0px'
      : `calc(-${activeIndex} * (100% + ${gap}px) / ${visibleCount})`

  return (
    <section className="banner-carousel-section" aria-label="Sorotan dan Promo Gerai">
      <div
        className="banner-carousel-wrapper"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (diff > 40) handleNext()
          else if (diff < -40) handlePrev()
          touchStartX.current = null
        }}
      >
        <div className="banner-carousel-viewport">
          <div
            className="banner-carousel-track"
            style={{ transform: `translateX(${translateFormula})` }}
          >
            {banners.map((banner, index) => {
              const image = resolveBannerImage(banner)
              const actionLink = resolveBannerActionLink(banner)

              return (
                <article
                  key={banner.id}
                  className="banner-card"
                  onClick={() => {
                    if (actionLink && onActionClick) {
                      onActionClick(actionLink)
                    }
                  }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={banner.title}
                      className="banner-card-img"
                      loading={index < 3 ? 'eager' : 'lazy'}
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="banner-card-pattern">
                      <span className="banner-card-pattern-icon" aria-hidden="true">
                        ☕
                      </span>
                    </div>
                  )}

                  <div className="banner-card-scrim" />

                  <div className="banner-card-content">
                    <h3 className="banner-card-title">{banner.title}</h3>

                    {banner.subtitle && (
                      <p className="banner-card-subtitle">{banner.subtitle}</p>
                    )}

                    {actionLink && (
                      <div className="banner-card-action">
                        {actionLink.startsWith('#') || actionLink === 'order' ? (
                          <button
                            type="button"
                            className="banner-card-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onActionClick) onActionClick(actionLink)
                            }}
                          >
                            Lihat Promo <span>↗</span>
                          </button>
                        ) : (
                          <a
                            href={actionLink}
                            className="banner-card-btn"
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Buka Info <span>↗</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {maxIndex > 0 && (
          <div className="banner-carousel-controls">
            <button
              type="button"
              className="banner-carousel-arrow-btn"
              onClick={handlePrev}
              aria-label="Banner sebelumnya"
            >
              ‹
            </button>

            <div
              className="banner-carousel-dots"
              role="tablist"
              aria-label="Indikator banner"
            >
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIndex}
                  aria-label={`Pindah ke slide ${i + 1}`}
                  className={`banner-carousel-dot ${i === activeIndex ? 'active' : ''}`}
                  onClick={() => setCurrent(i)}
                />
              ))}
            </div>

            <button
              type="button"
              className="banner-carousel-arrow-btn"
              onClick={handleNext}
              aria-label="Banner berikutnya"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
