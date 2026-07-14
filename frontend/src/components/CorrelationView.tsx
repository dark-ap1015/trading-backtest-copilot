// frontend/src/components/CorrelationView.tsx

import { useState, useEffect, useRef } from "react"
import CorrelationHeatmap from "./CorrelationHeatmap"

interface Ticker {
  symbol: string
  name: string
}

interface CorrelationResult {
  tickers: string[]
  matrix: number[][]
  ticker_results: {
    ticker: string
    source: string
    backtest_id: number | null
    equity_curve: { date: string; value: number }[]
    stats: string
  }[]
}

interface CorrelationViewProps {
  onBack: () => void
}

export default function CorrelationView({ onBack }: CorrelationViewProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Ticker[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [strategy, setStrategy] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CorrelationResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch suggestions as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!query.trim()) { setSuggestions([]); return }
      const res = await fetch(
        `http://localhost:8000/tickers/search?q=${encodeURIComponent(query)}&limit=8`,
        { credentials: "include" }
      )
      const data = await res.json()
      setSuggestions(data.filter((t: Ticker) => !selected.includes(t.symbol)))
    }, 200)
  }, [query, selected])

  function addTicker(symbol: string) {
    if (selected.includes(symbol) || selected.length >= 8) return
    setSelected([...selected, symbol])
    setQuery("")
    setSuggestions([])
  }

  function removeTicker(symbol: string) {
    setSelected(selected.filter(s => s !== symbol))
  }

  async function handleRun() {
    if (selected.length < 2 || !strategy || !start || !end) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("http://localhost:8000/correlation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tickers: selected, strategy, start, end }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Correlation check failed")
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = selected.length < 2 || !strategy || !start || !end

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Correlation Check</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            Run one strategy across multiple tickers and compare how their equity curves correlate.
          </p>
        </div>
        <button onClick={onBack} style={{
          padding: "0.6rem 1.2rem", background: "transparent",
          border: "1px solid #334155", borderRadius: "8px",
          color: "#94a3b8", cursor: "pointer", fontSize: "0.9rem",
        }}>
          ← Back
        </button>
      </div>

      {/* Ticker search */}
      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.25rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Tickers ({selected.length}/8 selected — min 2)
        </label>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {selected.map(sym => (
              <span key={sym} style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: "#3b82f6", color: "#fff",
                borderRadius: "6px", padding: "0.3rem 0.7rem", fontSize: "0.9rem", fontWeight: 600,
              }}>
                {sym}
                <span onClick={() => removeTicker(sym)} style={{ cursor: "pointer", opacity: 0.7 }}>✕</span>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div style={{ position: "relative" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={selected.length >= 8 ? "Max 8 tickers selected" : "Search ticker or company name..."}
            disabled={selected.length >= 8}
            style={{
              width: "100%", padding: "0.75rem 1rem",
              background: "#0f172a", border: "1px solid #334155",
              borderRadius: "8px", color: "#f1f5f9",
              fontSize: "0.95rem", boxSizing: "border-box", outline: "none",
            }}
          />

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: "8px", marginTop: "4px", zIndex: 50, overflow: "hidden",
            }}>
              {suggestions.map(t => (
                <div
                  key={t.symbol}
                  onClick={() => addTicker(t.symbol)}
                  style={{
                    padding: "0.65rem 1rem", cursor: "pointer",
                    display: "flex", justifyContent: "space-between",
                    borderBottom: "1px solid #0f172a",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#334155")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{t.symbol}</span>
                  <span style={{ color: "#64748b", fontSize: "0.9rem" }}>{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Strategy + dates */}
      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.25rem" }}>
        <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Strategy description
        </label>
        <textarea
          value={strategy}
          onChange={e => setStrategy(e.target.value)}
          rows={3}
          placeholder="e.g. Buy when the 20-day SMA crosses above the 50-day SMA..."
          style={{
            width: "100%", padding: "0.75rem 1rem",
            background: "#0f172a", border: "1px solid #334155",
            borderRadius: "8px", color: "#f1f5f9",
            fontSize: "0.95rem", boxSizing: "border-box",
            outline: "none", resize: "vertical", fontFamily: "inherit",
            marginBottom: "1rem",
          }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#94a3b8" }}>Start date</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#94a3b8" }}>End date</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: "#450a0a", border: "1px solid #991b1b", borderRadius: "8px",
          padding: "0.75rem 1rem", marginBottom: "1.25rem", color: "#fca5a5",
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={isDisabled || loading}
        style={{
          width: "100%", padding: "0.85rem",
          background: isDisabled || loading ? "#1e293b" : "#3b82f6",
          color: isDisabled || loading ? "#475569" : "#fff",
          border: "1px solid #334155", borderRadius: "8px",
          fontSize: "1rem", fontWeight: 600,
          cursor: isDisabled || loading ? "not-allowed" : "pointer",
          marginBottom: "2rem",
        }}
      >
        {loading ? "Running backtests and computing correlation..." : "Run Correlation Check →"}
      </button>

      {/* Results */}
      {result && <CorrelationHeatmap result={result} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.75rem 1rem",
  background: "#0f172a", border: "1px solid #334155",
  borderRadius: "8px", color: "#f1f5f9",
  fontSize: "0.95rem", boxSizing: "border-box", outline: "none",
}