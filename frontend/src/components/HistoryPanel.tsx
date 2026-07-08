import { useState, useEffect } from "react"

interface HistoryItem {
  id: number
  strategy: string
  ticker: string
  start_date: string
  end_date: string
  created_at: string
}

interface HistoryPanelProps {
  onSelect: (id: number) => void
}

export default function HistoryPanel({ onSelect }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("http://localhost:8000/backtest/history", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setHistory(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: "#64748b" }}>Loading history...</p>
  if (history.length === 0) return <p style={{ color: "#64748b" }}>No backtests yet.</p>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {history.map((item) => (
        <div
          key={item.id}
          onClick={() => onSelect(item.id)}
          style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: "8px", padding: "0.85rem 1rem",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0" }}>
            {item.ticker} · {item.start_date} → {item.end_date}
          </div>
          <div style={{
            fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {item.strategy}
          </div>
        </div>
      ))}
    </div>
  )
}