import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"

import TradeReplay from "./TradeReplay"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquityPoint {
  date: string
  value: number
}

interface ClassifierProfile {
  primary_timeframe: string
  secondary_timeframe: string | null
  data_source: "alpaca" | "yfinance"
  requires_multi_timeframe: boolean
  is_ambiguous: boolean
  reasoning: string
}

interface FormData {
  strategy: string
  ticker: string
  start: string
  end: string
}

interface Trade {
  [key: string]: string
}

interface BacktestResults {
  stats: string
  explanation: string
  equity_curve: EquityPoint[]
  trades: Trade[]
  classifier: ClassifierProfile
  formData: FormData
  ticker: string
  start_date: string
  end_date: string
}

interface ResultsViewProps {
  results: BacktestResults
  onReset: () => void
}

interface StatCardProps {
  label: string
  value: string | undefined
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAT_KEYS = [
  "Total Return [%]",
  "Sharpe Ratio",
  "Max Drawdown [%]",
  "Win Rate [%]",
  "Profit Factor",
  "Total Trades",
] as const

type StatKey = typeof STAT_KEYS[number]
type ParsedStats = Partial<Record<StatKey, string>>

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseStats(statsText: string): ParsedStats {
  const result: ParsedStats = {}
  for (const line of statsText.split("\n")) {
    for (const key of STAT_KEYS) {
      if (line.includes(key)) {
        const parts = line.split(/\s{2,}/)
        if (parts.length >= 2) {
          result[key] = parts[parts.length - 1].trim()
        }
      }
    }
  }
  return result
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }: StatCardProps) {
  const isNegative = typeof value === "string" && value.startsWith("-")
  return (
    <div style={{
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "1.25rem 1.5rem",
    }}>
      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.4rem" }}>
        {label}
      </div>
      <div style={{
        fontSize: "1.6rem", fontWeight: 700,
        color: isNegative ? "#f87171" : "#34d399"
      }}>
        {value ?? "—"}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResultsView({ results, onReset }: ResultsViewProps) {
  const { stats, explanation, equity_curve, classifier, formData } = results
  const parsedStats = parseStats(stats)

  const chartData: EquityPoint[] = equity_curve.length > 200
    ? equity_curve.filter((_: EquityPoint, i: number) =>
        i % Math.floor(equity_curve.length / 200) === 0
      )
    : equity_curve

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "2rem"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            {formData.ticker} Backtest Results
          </h1>
          <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            {formData.start} → {formData.end}
            &nbsp;·&nbsp;
            {classifier.primary_timeframe} bars
            &nbsp;·&nbsp;
            {classifier.data_source === "alpaca" ? "Alpaca" : "yfinance"}
            {classifier.requires_multi_timeframe && " · Multi-timeframe"}
          </p>
        </div>
        <button
          onClick={onReset}
          style={{
            padding: "0.6rem 1.2rem",
            background: "transparent",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          ← New Backtest
        </button>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "1rem",
        marginBottom: "2rem",
      }}>
        {STAT_KEYS.map((key: StatKey) => (
          <StatCard key={key} label={key} value={parsedStats[key]} />
        ))}
      </div>

      {/* Equity curve */}
      {chartData.length > 0 && (
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}>
          <h2 style={{ margin: "0 0 1.25rem", fontSize: "1rem", color: "#94a3b8" }}>
            Equity Curve
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(0, 10)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                width={80}
              />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={((v: number | string | readonly (string | number)[] | undefined) => {
                  if (v === undefined) return ["—", "Portfolio Value"]
                  return [`$${Number(v).toLocaleString()}`, "Portfolio Value"]
                }) as any}
                labelFormatter={(d: unknown) => {
                  if (typeof d === "string") return d.slice(0, 10)
                  return String(d)
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <TradeReplay
        trades={results.trades}
        strategy={formData.strategy}
        ticker={formData.ticker}
      />

      {/* AI explanation */}
      <div style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "1.5rem",
        marginBottom: "2rem",
      }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "#94a3b8" }}>
          AI Analysis
        </h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.75, fontSize: "0.95rem" }}>
          {explanation.split("\n\n").map((para: string, i: number) => (
            <p key={i} style={{ margin: "0 0 1rem" }}>{para}</p>
          ))}
        </div>
      </div>

      {/* Raw stats */}
      <details style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "1.5rem",
      }}>
        <summary style={{
          cursor: "pointer", color: "#94a3b8",
          fontSize: "0.9rem", userSelect: "none"
        }}>
          Raw stats output
        </summary>
        <pre style={{
          marginTop: "1rem", color: "#64748b",
          fontSize: "0.8rem", overflowX: "auto",
          whiteSpace: "pre-wrap"
        }}>
          {stats}
        </pre>
      </details>
    </div>
  )
}