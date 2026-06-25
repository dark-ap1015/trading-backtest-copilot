import { useState } from "react"

interface Trade {
  [key: string]: string
}

interface TradeReplayProps {
  trades: Trade[]
  strategy: string
  ticker: string
}

function formatValue(val: string | undefined): string {
  if (val === undefined) return "—"
  const num = Number(val)
  if (Number.isNaN(num)) return val
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function TradeReplay({ trades, strategy, ticker }: TradeReplayProps) {
  const [index, setIndex] = useState(0)
  const [commentary, setCommentary] = useState<string | null>(null)
  const [loadingCommentary, setLoadingCommentary] = useState(false)

  if (trades.length === 0) return null

  const trade = trades[index]
  const pnl = Number(trade["PnL"])
  const isWin = !Number.isNaN(pnl) && pnl > 0

  function goTo(newIndex: number) {
    setIndex(newIndex)
    setCommentary(null)   // reset commentary when changing trades
  }

  async function fetchCommentary() {
    setLoadingCommentary(true)
    try {
      const res = await fetch("http://localhost:8000/trade-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, ticker, trade }),
      })
      const data = await res.json()
      setCommentary(data.commentary)
    } catch {
      setCommentary("Could not load commentary for this trade.")
    } finally {
      setLoadingCommentary(false)
    }
  }

  return (
    <div style={{
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "1.5rem",
      marginBottom: "2rem",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: "1.25rem"
      }}>
        <h2 style={{ margin: 0, fontSize: "1rem", color: "#94a3b8" }}>
          Trade Replay
        </h2>
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
          Trade {index + 1} of {trades.length}
        </span>
      </div>

      {/* Trade card */}
      <div style={{
        background: "#0f172a",
        borderRadius: "10px",
        padding: "1.25rem",
        marginBottom: "1.25rem",
        border: `1px solid ${isWin ? "#16653480" : "#7f1d1d80"}`,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "1rem"
        }}>
          <span style={{
            fontSize: "0.8rem", fontWeight: 600,
            padding: "0.25rem 0.6rem", borderRadius: "6px",
            background: isWin ? "#16653430" : "#7f1d1d30",
            color: isWin ? "#4ade80" : "#f87171",
          }}>
            {isWin ? "WIN" : "LOSS"} · {trade["Direction"] ?? "—"}
          </span>
          <span style={{
            fontSize: "1.1rem", fontWeight: 700,
            color: isWin ? "#4ade80" : "#f87171",
          }}>
            {formatValue(trade["Return"])}%
          </span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem", fontSize: "0.9rem"
        }}>
          <div>
            <div style={{ color: "#64748b", fontSize: "0.78rem" }}>Entry</div>
            <div style={{ color: "#e2e8f0" }}>
              {trade["Entry Timestamp"]?.slice(0, 16) ?? "—"}
            </div>
            <div style={{ color: "#94a3b8" }}>
              @ {formatValue(trade["Avg Entry Price"])}
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "0.78rem" }}>Exit</div>
            <div style={{ color: "#e2e8f0" }}>
              {trade["Exit Timestamp"]?.slice(0, 16) ?? "—"}
            </div>
            <div style={{ color: "#94a3b8" }}>
              @ {formatValue(trade["Avg Exit Price"])}
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "0.78rem" }}>P&L</div>
            <div style={{ color: isWin ? "#4ade80" : "#f87171" }}>
              ${formatValue(trade["PnL"])}
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "0.78rem" }}>Duration</div>
            <div style={{ color: "#e2e8f0" }}>
              {trade["Duration"] ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Commentary section */}
      {commentary ? (
        <div style={{
          background: "#0f172a", borderRadius: "8px",
          padding: "1rem", marginBottom: "1.25rem",
          color: "#cbd5e1", fontSize: "0.9rem", lineHeight: 1.6,
        }}>
          {commentary}
        </div>
      ) : (
        <button
          onClick={fetchCommentary}
          disabled={loadingCommentary}
          style={{
            width: "100%", padding: "0.6rem",
            background: "transparent", border: "1px solid #334155",
            borderRadius: "8px", color: "#94a3b8",
            cursor: loadingCommentary ? "wait" : "pointer",
            fontSize: "0.85rem", marginBottom: "1.25rem",
          }}
        >
          {loadingCommentary ? "Analyzing trade..." : "Click for more info"}
        </button>
      )}

      {/* Prev/Next controls */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          style={{
            flex: 1, padding: "0.6rem",
            background: index === 0 ? "#1e293b" : "#334155",
            border: "1px solid #334155", borderRadius: "8px",
            color: index === 0 ? "#475569" : "#e2e8f0",
            cursor: index === 0 ? "not-allowed" : "pointer",
          }}
        >
          ← Previous
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === trades.length - 1}
          style={{
            flex: 1, padding: "0.6rem",
            background: index === trades.length - 1 ? "#1e293b" : "#334155",
            border: "1px solid #334155", borderRadius: "8px",
            color: index === trades.length - 1 ? "#475569" : "#e2e8f0",
            cursor: index === trades.length - 1 ? "not-allowed" : "pointer",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}