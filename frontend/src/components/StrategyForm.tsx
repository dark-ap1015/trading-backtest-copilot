import { useState } from "react"

interface FormData {
  strategy: string
  ticker: string
  start: string
  end: string
}

interface StrategyFormProps {
  onSubmit: (data: FormData) => void
  error: string | null
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#f1f5f9",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.4rem",
  fontSize: "0.85rem",
  color: "#94a3b8",
  fontWeight: 500,
}

export default function StrategyForm({ onSubmit, error }: StrategyFormProps) {
  const [form, setForm] = useState<FormData>({
    strategy: "",
    ticker: "",
    start: "",
    end: "",
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit() {
    if (!form.strategy || !form.ticker || !form.start || !form.end) return
    onSubmit({ ...form, ticker: form.ticker.toUpperCase() })
  }

  const isDisabled = !form.strategy || !form.ticker || !form.start || !form.end

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: "2rem"
    }}>
      <div style={{
        width: "100%", maxWidth: "560px",
        background: "#1e293b",
        borderRadius: "16px",
        padding: "2.5rem",
        border: "1px solid #334155",
      }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            AI Backtest Co-pilot
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            Describe a trading strategy. We'll write and run the backtest for you.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "#450a0a", border: "1px solid #991b1b",
            borderRadius: "8px", padding: "0.75rem 1rem",
            marginBottom: "1.5rem", color: "#fca5a5", fontSize: "0.9rem"
          }}>
            {error}
          </div>
        )}

        {/* Strategy textarea */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={labelStyle}>Strategy description</label>
          <textarea
            name="strategy"
            value={form.strategy}
            onChange={handleChange}
            rows={4}
            placeholder="e.g. Buy SPY when the 20-day SMA crosses above the 50-day SMA..."
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Ticker */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={labelStyle}>Ticker</label>
          <input
            name="ticker"
            value={form.ticker}
            onChange={handleChange}
            placeholder="e.g. SPY"
            style={{ ...inputStyle, textTransform: "uppercase" }}
          />
        </div>

        {/* Date range */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "1rem", marginBottom: "2rem"
        }}>
          <div>
            <label style={labelStyle}>Start date</label>
            <input
              name="start"
              type="date"
              value={form.start}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End date</label>
            <input
              name="end"
              type="date"
              value={form.end}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          style={{
            width: "100%",
            padding: "0.85rem",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: isDisabled ? "not-allowed" : "pointer",
            opacity: isDisabled ? 0.5 : 1,
          }}
        >
          Run Backtest →
        </button>
      </div>
    </div>
  )
}