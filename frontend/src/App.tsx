import { useState, useEffect } from "react"
import LoginForm from "./components/LoginForm"
import SignupForm from "./components/SignupForm"
import StrategyForm from "./components/StrategyForm"
import ResultsView from "./components/ResultsView"
import HistoryPanel from "./components/HistoryPanel"
import CorrelationView from "./components/CorrelationView"

type AuthPhase = "checking" | "login" | "signup" | "authed"
type AppPhase = "form" | "loading" | "results" | "correlation"

interface FormData {
  strategy: string
  ticker: string
  start: string
  end: string
}

export default function App() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking")
  const [appPhase, setAppPhase] = useState<AppPhase>("form")
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    fetch("http://localhost:8000/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) setAuthPhase("authed")
        else setAuthPhase("login")
      })
      .catch(() => setAuthPhase("login"))
  }, [])

  async function handleSubmit(formData: FormData) {
    setAppPhase("loading")
    setError(null)

    try {
      const res = await fetch("http://localhost:8000/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Backtest failed")
      }

      const data = await res.json()
      setResults({ ...data, formData })
      setAppPhase("results")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed")
      setAppPhase("form")
    }
  }

  async function handleSelectHistory(id: number) {
    setHistoryOpen(false)
    setAppPhase("loading")
    try {
      const res = await fetch(`http://localhost:8000/backtest/${id}`, {
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error("Failed to load backtest")
      }
      const data = await res.json()
      // Backend now returns ticker/start_date/end_date directly on saved backtests
      setResults({
        ...data,
        formData: {
          strategy: "(loaded from history)",
          ticker: data.ticker,
          start: data.start_date,
          end: data.end_date,
        },
      })
      setAppPhase("results")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load backtest")
      setAppPhase("form")
    }
  }

  function handleReset() {
    setAppPhase("form")
    setResults(null)
    setError(null)
  }

  // ── Auth gating ──────────────────────────────────────────────────────────

  if (authPhase === "checking") {
    return <div style={{ color: "#94a3b8", padding: "2rem" }}>Loading...</div>
  }

  if (authPhase === "login") {
    return (
      <LoginForm
        onSuccess={() => setAuthPhase("authed")}
        onSwitchToSignup={() => setAuthPhase("signup")}
      />
    )
  }

  if (authPhase === "signup") {
    return (
      <SignupForm
        onSuccess={() => setAuthPhase("authed")}
        onSwitchToLogin={() => setAuthPhase("login")}
      />
    )
  }

  // ── Authenticated app ────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", position: "relative", paddingTop: "60px"}}>
      {/* Top navigation bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "60px",
        background: "#0f172a", borderBottom: "1px solid #1e293b",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1.5rem", zIndex: 20,
      }}>
        <span
          onClick={() => { setAppPhase("form"); setResults(null); setError(null); }}
          style={{ fontWeight: 700, fontSize: "1rem", color: "#f1f5f9", cursor: "pointer" }}
        >
          AI Backtest Co-pilot
        </span>

        {!historyOpen && (
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => setAppPhase("correlation")}
              style={{
                padding: "0.5rem 1rem",
                background: appPhase === "correlation" ? "#3b82f6" : "transparent",
                border: "1px solid #334155", borderRadius: "8px",
                color: appPhase === "correlation" ? "#fff" : "#94a3b8",
                cursor: "pointer", fontSize: "0.85rem",
              }}
            >
              Correlation
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent", border: "1px solid #334155",
                borderRadius: "8px", color: "#94a3b8",
                cursor: "pointer", fontSize: "0.85rem",
              }}
            >
              History
            </button>
          </div>
        )}
      </div>

      {/* Sidebar overlay */}
      {historyOpen && (
        <>
          <div
            onClick={() => setHistoryOpen(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.5)", zIndex: 10,
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, height: "100vh",
            width: "340px", background: "#0f172a",
            borderLeft: "1px solid #334155",
            padding: "5rem 1.25rem 1.25rem",
            overflowY: "auto", zIndex: 15,
          }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>Backtest History</h2>
            <HistoryPanel onSelect={handleSelectHistory} />
          </div>
        </>
      )}

      {/* Main content */}
      {appPhase === "form" && (
        <StrategyForm onSubmit={handleSubmit} error={error} />
      )}
      {appPhase === "loading" && <LoadingScreen />}
      {appPhase === "results" && (
        <ResultsView results={results} onReset={handleReset} />
      )}
      {appPhase === "correlation" && (
        <CorrelationView onBack={() => setAppPhase("form")} />
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      minHeight: "100vh", gap: "1.5rem"
    }}>
      <div style={{ fontSize: "2.5rem" }}>⚙️</div>
      <p style={{ fontSize: "1.1rem", color: "#94a3b8" }}>
        Running backtest in sandbox...
      </p>
      <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
        This typically takes 1-2 minutes...
      </p>
    </div>
  )
}