// frontend/src/components/CorrelationHeatmap.tsx

interface CorrelationResult {
  tickers: string[]
  matrix: number[][]
  ticker_results: {
    ticker: string
    source: string
    equity_curve: { date: string; value: number }[]
    stats: string
  }[]
}

interface Props {
  result: CorrelationResult
}

function getColor(value: number): string {
  // -1 (negative) → red, 0 (uncorrelated) → white, +1 (positive) → blue
  if (value >= 0) {
    const intensity = Math.round(value * 180)
    return `rgb(${255 - intensity}, ${255 - intensity}, 255)`
  } else {
    const intensity = Math.round(Math.abs(value) * 180)
    return `rgb(255, ${255 - intensity}, ${255 - intensity})`
  }
}

function getTextColor(value: number): string {
  return Math.abs(value) > 0.5 ? "#fff" : "#1e293b"
}

function interpretCorrelation(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 0.8) return value > 0 ? "Strongly correlated" : "Strongly inverse"
  if (abs >= 0.5) return value > 0 ? "Moderately correlated" : "Moderately inverse"
  if (abs >= 0.2) return value > 0 ? "Weakly correlated" : "Weakly inverse"
  return "Uncorrelated"
}

export default function CorrelationHeatmap({ result }: Props) {
  const { tickers, matrix, ticker_results } = result
  const n = tickers.length

  return (
    <div>
      {/* Heatmap */}
      <div style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem",
      }}>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "1rem", color: "#94a3b8" }}>
          Correlation Matrix
        </h2>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: "#64748b" }}>
          Based on daily equity curve returns. Blue = positive correlation, Red = negative, White = uncorrelated.
        </p>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: `80px ${"1fr ".repeat(n)}`, gap: "4px", marginBottom: "4px" }}>
          <div />
          {tickers.map(t => (
            <div key={t} style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8" }}>
              {t}
            </div>
          ))}
        </div>

        {/* Rows */}
        {tickers.map((rowTicker, i) => (
          <div key={rowTicker} style={{ display: "grid", gridTemplateColumns: `80px ${"1fr ".repeat(n)}`, gap: "4px", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8" }}>
              {rowTicker}
            </div>
            {matrix[i].map((val, j) => (
              <div
                key={j}
                title={`${tickers[i]} vs ${tickers[j]}: ${val.toFixed(2)} — ${interpretCorrelation(val)}`}
                style={{
                  background: getColor(val),
                  borderRadius: "6px",
                  padding: "0.6rem 0.25rem",
                  textAlign: "center",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: getTextColor(val),
                  cursor: "default",
                  transition: "opacity 0.15s",
                }}
              >
                {i === j ? "—" : val.toFixed(2)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem",
        display: "flex", gap: "1.5rem", flexWrap: "wrap",
      }}>
        {[
          { label: "≥ 0.8", desc: "Strongly correlated — strategies move together", color: getColor(0.9) },
          { label: "0.5–0.8", desc: "Moderately correlated", color: getColor(0.65) },
          { label: "0.2–0.5", desc: "Weakly correlated", color: getColor(0.35) },
          { label: "< 0.2", desc: "Uncorrelated — good diversification", color: getColor(0.05) },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "4px", background: item.color, border: "1px solid #334155" }} />
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0" }}>{item.label}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-ticker source + stats summary */}
      <div style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: "12px", padding: "1.5rem",
      }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "#94a3b8" }}>
          Individual Results
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {ticker_results.map(r => (
            <div key={r.ticker} style={{
              background: "#0f172a", borderRadius: "8px",
              padding: "0.85rem 1rem", border: "1px solid #334155",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span style={{ fontWeight: 700, fontSize: "1rem", color: "#f1f5f9" }}>{r.ticker}</span>
                <span style={{
                  fontSize: "0.75rem", fontWeight: 600,
                  padding: "0.2rem 0.5rem", borderRadius: "4px",
                  background: r.source === "history" ? "#1e3a5f" : "#16532d",
                  color: r.source === "history" ? "#93c5fd" : "#86efac",
                }}>
                  {r.source === "history" ? "From history" : "Fresh run"}
                </span>
              </div>
              {/* Extract Total Return from stats text */}
              {(() => {
                const line = r.stats.split("\n").find(l => l.includes("Total Return"))
                const parts = line?.split(/\s{2,}/)
                const val = parts?.[parts.length - 1]?.trim()
                const isNeg = val?.startsWith("-")
                return val ? (
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: isNeg ? "#f87171" : "#34d399" }}>
                    {val}%
                  </div>
                ) : null
              })()}
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>Total Return</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}