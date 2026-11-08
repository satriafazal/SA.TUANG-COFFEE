import React from 'react'

export interface AdminPaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const AdminPagination: React.FC<AdminPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 30, 50],
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, currentPage * pageSize)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="admin-pagination">
      <div className="admin-pagination-info">
        <span className="admin-pagination-counter">
          {totalItems === 0
            ? 'Tidak ada data'
            : `Menampilkan ${startItem}–${endItem} dari ${totalItems} data`}
        </span>
        <div className="admin-pagination-size">
          <span>Baris:</span>
          <select
            className="admin-pagination-select"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value))
              onPageChange(1)
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-pagination-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Halaman sebelumnya"
        >
          ‹ Sebelumnya
        </button>

        {getPageNumbers().map((page, idx) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="admin-pagination-ellipsis">
                …
              </span>
            )
          }

          const isCurrent = page === currentPage
          return (
            <button
              key={`page-${page}`}
              type="button"
              className={`admin-pagination-btn ${isCurrent ? 'active' : ''}`}
              onClick={() => onPageChange(Number(page))}
            >
              {page}
            </button>
          )
        })}

        <button
          type="button"
          className="admin-pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Halaman berikutnya"
        >
          Berikutnya ›
        </button>
      </div>
    </div>
  )
}
