import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Upload, Download, Check, AlertCircle, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadPlayerTemplate, uploadPlayerFile, importPlayers } from '../api'

const SYSTEM_FIELDS = [
  { value: 'name', label: 'Player Name *' },
  { value: 'role', label: 'Role *' },
  { value: 'country', label: 'Country *' },
  { value: 'base_price', label: 'Base Price *' },
  { value: 'image_url', label: 'Image URL' },
  { value: 'matches', label: 'Matches' },
  { value: 'runs', label: 'Runs' },
  { value: 'wickets', label: 'Wickets' },
  { value: 'batting_avg', label: 'Batting Average' },
  { value: 'batting_sr', label: 'Batting Strike Rate' },
  { value: 'bowling_avg', label: 'Bowling Average' },
  { value: 'bowling_econ', label: 'Bowling Economy' },
]

type Step = 'upload' | 'mapping' | 'preview' | 'done'

export default function PlayerImport() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})  // colIndex → fieldKey
  const [suggestedMapping, setSuggestedMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)

  const handleDownloadTemplate = async () => {
    if (!auctionId) return
    try {
      const blob = await downloadPlayerTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'player_import_template.xlsx'; a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Template downloaded')
    } catch { toast.error('Failed to download template') }
  }

  const handleFileUpload = async (file: File) => {
    if (!auctionId) return
    setUploading(true)
    setFileName(file.name)
    try {
      const res = await uploadPlayerFile(Number(auctionId), file)
      setHeaders(res.headers)
      setRows(res.rows)
      setTotalRows(res.total_rows)
      setSuggestedMapping(res.suggested_mapping)

      // Apply suggested mapping
      const initialMapping: Record<string, string> = {}
      for (const [colIdx, fieldKey] of Object.entries(res.suggested_mapping)) {
        initialMapping[colIdx] = fieldKey as string
      }
      setMapping(initialMapping)
      setStep('mapping')
      toast.success(`Parsed ${res.total_rows} rows`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to parse file')
    } finally {
      setUploading(false)
    }
  }

  const updateMapping = (colIdx: string, fieldKey: string) => {
    setMapping(prev => {
      const next = { ...prev }
      if (fieldKey === '') {
        delete next[colIdx]
      } else {
        next[colIdx] = fieldKey
      }
      return next
    })
  }

  const applySuggestedMapping = () => {
    setMapping(suggestedMapping)
    toast.success('Auto-mapping applied')
  }

  const handleImport = async () => {
    if (!auctionId) return
    setImporting(true)
    try {
      const res = await importPlayers(Number(auctionId), mapping, rows)
      setResult(res)
      setStep('done')
      if (res.players_created > 0) {
        toast.success(`${res.players_created} players imported!`)
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const isRequiredMapped = ['name', 'role', 'country', 'base_price'].every(
    f => Object.values(mapping).includes(f)
  )

  return (
    <div className="animate-fade-in noise-bg min-h-screen bg-surface-0 p-6 md:p-8">
      {/* Breadcrumb */}
      <nav className="text-xs tracking-widest font-display mb-6 text-white/30">
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/dashboard')}>HOME</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate(`/auctions/${auctionId}/players`)}>PLAYERS</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-accent-gold font-semibold">IMPORT</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(`/auctions/${auctionId}/players`)} className="text-white/30 hover:text-accent-gold transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-3xl md:text-4xl tracking-wider gradient-text">IMPORT PLAYERS</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {(['upload', 'mapping', 'preview', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
              step === s ? 'bg-accent-gold text-black border-accent-gold' :
              ['upload', 'mapping', 'preview', 'done'].indexOf(step) > i ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              'bg-surface-2 text-gray-600 border-white/10'
            }`}>{i + 1}</div>
            <span className={`text-xs font-display tracking-wider ${step === s ? 'text-white' : 'text-gray-600'}`}>
              {s === 'upload' ? 'UPLOAD' : s === 'mapping' ? 'MAP COLUMNS' : s === 'preview' ? 'PREVIEW' : 'DONE'}
            </span>
            {i < 3 && <div className="w-8 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="glass-strong rounded-2xl p-8 border border-white/[0.08] max-w-2xl">
          <h2 className="font-display text-xl tracking-wider text-accent-gold mb-4">UPLOAD SPREADSHEET</h2>
          <p className="text-sm text-white/30 mb-6">
            Upload an Excel (.xlsx) or CSV file with player data. Download the template for the correct column format.
          </p>

          <motion.button
            onClick={handleDownloadTemplate}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-surface-3 hover:bg-surface-4 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm border border-white/5 mb-6 transition-colors"
          >
            <Download className="w-4 h-4" /> Download Template
          </motion.button>

          <input
            type="file"
            accept=".xlsx,.csv"
            ref={fileRef}
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }}
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-white/10 hover:border-accent-gold/30 rounded-2xl p-12 flex flex-col items-center gap-4 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-10 h-10 border-3 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            ) : (
              <>
                <FileSpreadsheet className="w-12 h-12 text-white/20" />
                <div className="text-center">
                  <div className="text-white/60 font-medium mb-1">Click to upload .xlsx or .csv</div>
                  <div className="text-xs text-white/30">Supports Excel and CSV formats</div>
                </div>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <div className="glass-strong rounded-2xl p-8 border border-white/[0.08] max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl tracking-wider text-accent-gold">MAP COLUMNS</h2>
              <p className="text-sm text-white/30 mt-1">
                {fileName} — {totalRows} rows found. Map your columns to player fields.
              </p>
            </div>
            <button onClick={applySuggestedMapping} className="text-xs tracking-wider text-white/40 hover:text-accent-gold font-display flex items-center gap-1.5 transition-colors">
              Auto-map Columns
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {headers.map((header, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-48 text-sm text-white/60 font-mono bg-surface-2 px-3 py-2 rounded-lg border border-white/5 truncate">
                  {header || `Column ${idx + 1}`}
                </div>
                <span className="text-white/20">→</span>
                <select
                  value={mapping[String(idx)] || ''}
                  onChange={e => updateMapping(String(idx), e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm transition-all"
                >
                  <option value="">— Skip —</option>
                  {SYSTEM_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className={`text-sm ${isRequiredMapped ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isRequiredMapped ? '✓ All required fields mapped' : '⚠ Map all required fields (Name, Role, Country, Base Price)'}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="text-xs text-white/40 hover:text-white font-display tracking-wider transition-colors">
                ← Back
              </button>
              <motion.button
                onClick={() => setStep('preview')}
                disabled={!isRequiredMapped}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-accent-gold to-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
              >
                Preview →
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="glass-strong rounded-2xl p-8 border border-white/[0.08]">
          <h2 className="font-display text-xl tracking-wider text-accent-gold mb-4">PREVIEW IMPORT</h2>
          <p className="text-sm text-white/30 mb-6">{rows.length} rows will be imported as players.</p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {Object.entries(mapping).map(([colIdx, fieldKey]) => (
                    <th key={colIdx} className="text-left py-2 px-3 text-white/30 font-display tracking-wider text-xs">
                      {SYSTEM_FIELDS.find(f => f.value === fieldKey)?.label || fieldKey}
                    </th>
                  ))}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, rowIdx) => {
                  const mappedValues = Object.entries(mapping).map(([colIdx]) => {
                    const val = row[Number(colIdx)] || ''
                    return val.length > 30 ? val.substring(0, 30) + '...' : val
                  })
                  const hasEmpty = ['name', 'role', 'country', 'base_price'].some(f => {
                    const col = Object.entries(mapping).find(([_, v]) => v === f)?.[0]
                    return col && !row[Number(col)]?.trim()
                  })
                  return (
                    <tr key={rowIdx} className={`border-b border-white/[0.03] ${hasEmpty ? 'bg-rose-500/5' : ''}`}>
                      {mappedValues.map((val, i) => (
                        <td key={i} className="py-2 px-3 text-gray-300 whitespace-nowrap">{val || '—'}</td>
                      ))}
                      <td className="py-2 px-3">
                        {hasEmpty && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length > 20 && (
              <div className="text-xs text-white/30 py-2 text-center">...and {rows.length - 20} more rows</div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button onClick={() => setStep('mapping')} className="text-xs text-white/40 hover:text-white font-display tracking-wider transition-colors">
              ← Back to Mapping
            </button>
            <motion.button
              onClick={handleImport}
              disabled={importing}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              <Upload className="w-4 h-4" /> {importing ? 'Importing...' : `Import ${rows.length} Players`}
            </motion.button>
          </div>
        </div>
      )}

      {/* Done Step */}
      {step === 'done' && result && (
        <div className="glass-strong rounded-2xl p-8 border border-white/[0.08] max-w-2xl text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
            <Check className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-display text-2xl tracking-wider text-white mb-2">IMPORT COMPLETE</h2>
            <div className="text-sm text-white/40 mb-6">
              <span className="text-emerald-400 font-bold">{result.players_created}</span> of {result.total_rows} players created
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="text-left bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 mb-6">
                <div className="text-xs text-rose-400 font-display tracking-wider mb-2">ERRORS ({result.errors.length})</div>
                {result.errors.map((err: string, i: number) => (
                  <div key={i} className="text-xs text-rose-300/80 py-0.5">{err}</div>
                ))}
              </div>
            )}
            <motion.button
              onClick={() => navigate(`/auctions/${auctionId}/players`)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-accent-gold to-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm"
            >
              View Players →
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
