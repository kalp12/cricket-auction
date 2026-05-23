import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Upload, Check, AlertCircle, FileSpreadsheet, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadStatsFile, commitStatsImport } from '../api'
import { Card } from '../components/ui'

const STAT_FIELDS = [
  { value: 'name', label: 'Player Name / ID *' },
  { value: 'player_id', label: 'Player ID (exact match)' },
  { value: 'matches', label: 'Matches' },
  { value: 'runs', label: 'Runs' },
  { value: 'wickets', label: 'Wickets' },
  { value: 'batting_avg', label: 'Batting Average' },
  { value: 'batting_sr', label: 'Batting Strike Rate' },
  { value: 'bowling_avg', label: 'Bowling Average' },
  { value: 'bowling_econ', label: 'Bowling Economy' },
]

const SOURCES = [
  { value: 'custom', label: 'Custom Spreadsheet' },
  { value: 'espn_cricinfo', label: 'ESPN Cricinfo Export' },
  { value: 'cricbuzz', label: 'Cricbuzz CSV' },
  { value: 'howstat', label: 'HowStat Export' },
]

type Step = 'upload' | 'mapping' | 'diff' | 'done'

export default function StatsImport() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')
  const [source, setSource] = useState('custom')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [suggestedMapping, setSuggestedMapping] = useState<Record<string, string>>({})
  const [matchedRows, setMatchedRows] = useState<any[]>([])
  const [playerNames, setPlayerNames] = useState<Record<number, string>>({})
  const [playerOverrides, setPlayerOverrides] = useState<Record<string, number>>({})
  const [result, setResult] = useState<any>(null)

  const aid = Number(auctionId)

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setFileName(file.name)
    try {
      const res = await uploadStatsFile(aid, file)
      setHeaders(res.headers)
      setRows(res.rows)
      setTotalRows(res.total_rows)
      setSuggestedMapping(res.suggested_mapping)
      const initialMapping: Record<string, string> = {}
      for (const [colIdx, fieldKey] of Object.entries(res.suggested_mapping)) {
        initialMapping[colIdx] = fieldKey as string
      }
      setMapping(initialMapping)
      setMatchedRows(res.matched_rows)
      setPlayerNames(res.player_names)
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
      if (fieldKey === '') delete next[colIdx]
      else next[colIdx] = fieldKey
      return next
    })
  }

  const hasPlayerIdentifier = Object.values(mapping).some(v => v === 'name' || v === 'player_id')
  const hasStatField = Object.values(mapping).some(v => !['name', 'player_id'].includes(v))

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await commitStatsImport(aid, source, mapping, rows, playerOverrides)
      setResult(res)
      setStep('done')
      if (res.updates_applied > 0) {
        toast.success(`${res.updates_applied} player stats updated!`)
      } else {
        toast('No changes detected — all stats are already up to date', { icon: 'ℹ️' })
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="animate-fade-in noise-bg min-h-screen bg-surface-0">
      <nav className="text-xs tracking-widest font-display mb-6 text-white/30">
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/dashboard')}>HOME</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate('/auctions')}>AUCTIONS</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-white/40 hover:text-accent-gold cursor-pointer transition-colors" onClick={() => navigate(`/auctions/${auctionId}/players`)}>PLAYERS</span>
        <span className="mx-2 text-white/20">›</span>
        <span className="text-accent-gold font-semibold">STATS IMPORT</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(`/auctions/${auctionId}/players`)} className="text-white/30 hover:text-accent-gold transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-3xl md:text-4xl tracking-wider gradient-text">IMPORT PLAYER STATS</h1>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {(['upload', 'mapping', 'diff', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
              step === s ? 'bg-accent-gold text-black border-accent-gold' :
              ['upload', 'mapping', 'diff', 'done'].indexOf(step) > i ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              'bg-surface-2 text-gray-600 border-white/10'
            }`}>{i + 1}</div>
            <span className={`text-xs font-display tracking-wider ${step === s ? 'text-white' : 'text-gray-600'}`}>
              {s === 'upload' ? 'UPLOAD' : s === 'mapping' ? 'MAP COLUMNS' : s === 'diff' ? 'DIFF PREVIEW' : 'DONE'}
            </span>
            {i < 3 && <div className="w-8 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card className="max-w-2xl">
          <h2 className="font-display text-xl tracking-wider text-accent-gold mb-4">UPLOAD STATS SPREADSHEET</h2>
          <p className="text-sm text-white/30 mb-4">
            Upload an Excel (.xlsx) or CSV file with player stats. The system will auto-match players by name and show you a diff before applying changes.
          </p>

          <div className="mb-6">
            <label className="text-xs tracking-wider text-white/40 font-display mb-2 block">DATA SOURCE</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm">
              {SOURCES.map(s => <option key={s.value} value={s.value} className="bg-surface-2 text-white">{s.label}</option>)}
            </select>
          </div>

          <input type="file" accept=".xlsx,.csv" ref={fileRef} className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }} />

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full border-2 border-dashed border-white/10 hover:border-accent-gold/30 rounded-2xl p-12 flex flex-col items-center gap-4 transition-all disabled:opacity-50">
            {uploading ? (
              <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            ) : (
              <>
                <FileSpreadsheet className="w-12 h-12 text-white/20" />
                <div className="text-center">
                  <div className="text-white/60 font-medium mb-1">Click to upload .xlsx or .csv</div>
                  <div className="text-xs text-white/30">Supports ESPN Cricinfo, Cricbuzz, HowStat, or custom formats</div>
                </div>
              </>
            )}
          </button>
        </Card>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <Card className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl tracking-wider text-accent-gold">MAP COLUMNS</h2>
              <p className="text-sm text-white/30 mt-1">{fileName} — {totalRows} rows. Map your columns to player fields.</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {headers.map((header, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-48 text-sm text-white/60 font-mono bg-surface-2 px-3 py-2 rounded-lg border border-white/5 truncate">
                  {header || `Column ${idx + 1}`}
                </div>
                <span className="text-white/20">→</span>
                <select value={mapping[String(idx)] || ''} onChange={e => updateMapping(String(idx), e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-white/5 text-white focus:ring-2 focus:ring-accent-gold/50 outline-none text-sm">
                  <option value="">— Skip —</option>
                  {STAT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className={`text-sm ${hasPlayerIdentifier ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hasPlayerIdentifier ? '✓ Player identifier mapped' : '⚠ Map a player name or ID column'}
              {hasPlayerIdentifier && !hasStatField && <span className="text-amber-400 ml-2">⚠ Map at least one stat field</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="text-xs text-white/40 hover:text-white font-display tracking-wider transition-colors">← Back</button>
              <motion.button onClick={() => setStep('diff')} disabled={!hasPlayerIdentifier || !hasStatField}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-accent-gold to-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all">
                Preview Diff →
              </motion.button>
            </div>
          </div>
        </Card>
      )}

      {/* Diff Preview Step */}
      {step === 'diff' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl tracking-wider text-accent-gold">DIFF PREVIEW</h2>
              <p className="text-sm text-white/30 mt-1">Review stat changes before applying. <span className="text-rose-400">Red</span> = old, <span className="text-emerald-400">green</span> = new.</p>
            </div>
          </div>

          {/* Unmatched warning */}
          {matchedRows.some(m => !m.player_id) && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm mb-4">
              <div className="font-display tracking-wider text-xs mb-1">UNMATCHED PLAYERS</div>
              {matchedRows.map((m, i) => !m.player_id && (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className="text-white/60">Row {i + 1}:</span>
                  <span className="text-white/80">{m.player_name || 'Unknown'}</span>
                  <select value={playerOverrides[String(i)] || ''}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setPlayerOverrides(prev => {
                        const next = { ...prev }
                        if (val) next[String(i)] = val
                        else delete next[String(i)]
                        return next
                      })
                    }}
                    className="px-2 py-1 rounded-lg bg-surface-2 border border-white/5 text-white text-xs outline-none">
                    <option value="">— Select player —</option>
                    {Object.entries(playerNames).map(([pid, pname]) => (
                      <option key={pid} value={pid} className="bg-surface-2 text-white">{pname}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 px-3 text-white/30 font-display tracking-wider text-xs">Player</th>
                  <th className="text-left py-2 px-3 text-white/30 font-display tracking-wider text-xs">Match</th>
                  {Object.entries(mapping).filter(([_, f]) => f !== 'name' && f !== 'player_id').map(([colIdx, fieldKey]) => (
                    <th key={colIdx} className="text-left py-2 px-3 text-white/30 font-display tracking-wider text-xs">
                      {STAT_FIELDS.find(f => f.value === fieldKey)?.label || fieldKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchedRows.slice(0, 50).map((m, i) => {
                  const resolvedPid = playerOverrides[String(i)] || m.player_id
                  const matchLabel = m.confidence === 'exact' ? '✓ Exact' : m.confidence === 'fuzzy' ? '~ Fuzzy' : m.confidence === 'exact_id' ? '✓ ID' : resolvedPid ? '✓ Manual' : '✗'
                  const matchColor = matchLabel.startsWith('✓') ? 'text-emerald-400' : matchLabel.startsWith('~') ? 'text-amber-400' : 'text-rose-400'

                  return (
                    <tr key={i} className={`border-b border-white/[0.03] ${!resolvedPid ? 'bg-rose-500/5' : ''}`}>
                      <td className="py-2 px-3 text-white font-medium">
                        {resolvedPid ? playerNames[resolvedPid] || m.player_name : m.player_name || '—'}
                      </td>
                      <td className={`py-2 px-3 text-xs font-medium ${matchColor}`}>{matchLabel}</td>
                      {Object.entries(mapping).filter(([_, f]) => f !== 'name' && f !== 'player_id').map(([colIdx]) => {
                        const val = m.row[Number(colIdx)] || '—'
                        return <td key={colIdx} className="py-2 px-3 text-gray-300 whitespace-nowrap">{val}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {matchedRows.length > 50 && (
              <div className="text-xs text-white/30 py-2 text-center">...and {matchedRows.length - 50} more rows</div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button onClick={() => setStep('mapping')} className="text-xs text-white/40 hover:text-white font-display tracking-wider transition-colors">← Back to Mapping</button>
            <motion.button onClick={handleImport} disabled={importing}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-4 h-4" /> {importing ? 'Applying...' : `Apply ${totalRows} Updates`}
            </motion.button>
          </div>
        </Card>
      )}

      {/* Done Step */}
      {step === 'done' && result && (
        <Card className="max-w-2xl text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
            <Check className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-display text-2xl tracking-wider text-white mb-2">STATS IMPORT COMPLETE</h2>
            <div className="text-sm text-white/40 mb-6">
              <span className="text-emerald-400 font-bold">{result.updates_applied}</span> of {result.total_rows} players updated
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="text-left bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 mb-6">
                <div className="text-xs text-rose-400 font-display tracking-wider mb-2">ERRORS ({result.errors.length})</div>
                {result.errors.map((err: string, i: number) => (
                  <div key={i} className="text-xs text-rose-300/80 py-0.5">{err}</div>
                ))}
              </div>
            )}
            <motion.button onClick={() => navigate(`/auctions/${auctionId}/players`)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-accent-gold to-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm">
              View Players →
            </motion.button>
          </motion.div>
        </Card>
      )}
    </div>
  )
}
