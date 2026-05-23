import { useState, useRef, useEffect } from 'react'
import { FileDown, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface ExportOption {
  label: string
  onClick: (format: 'xlsx' | 'csv') => Promise<void>
}

interface Props {
  options: ExportOption[]
}

export default function ExportMenu({ options }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const downloadBlob = async (fn: () => Promise<Blob>, filename: string) => {
    try {
      const blob = await fn()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Downloaded ' + filename)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-surface-3 hover:bg-surface-4 text-white/60 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border border-white/5 transition-colors"
      >
        <FileDown className="w-4 h-4" />
        Export
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-surface-2 border border-white/10 rounded-xl shadow-2xl shadow-black/40 py-1.5 min-w-[220px] animate-fade-in">
          {options.map((opt, i) => (
            <div key={i}>
              <div className="px-3 py-1.5 text-[10px] text-gray-500 font-display tracking-widest uppercase">{opt.label}</div>
              {(['xlsx', 'csv'] as const).map(format => {
                const key = `${i}-${format}`
                return (
                  <button
                    key={key}
                    disabled={exporting !== null}
                    onClick={async () => {
                      setExporting(key)
                      setOpen(false)
                      await opt.onClick(format)
                      setExporting(null)
                    }}
                    className="w-full text-left px-5 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-40"
                  >
                    {exporting === key ? (
                      <div className="w-4 h-4 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    {format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
                  </button>
                )
              })}
              {i < options.length - 1 && <div className="my-1 border-t border-white/5" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
