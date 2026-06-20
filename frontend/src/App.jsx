import { useState } from "react"
import StrategyForm from "./components/StrategyForm"
import ResultsView from "./components/ResultsView"

export default function App() {
  const [phase, setPhase] = useState("form")   // "form" | "loading" | "results"
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(formData) {
    setPhase("loading")
    setError(null)

    try {
      const res = await fetch("http://localhost:8000/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Backtest failed")
      }

      const data = await res.json()
      setResults({ ...data, formData })
      setPhase("results")
    } catch (e) {
      setError(e.message)
      setPhase("form")
    }
  }

  function handleReset() {
    setPhase("form")
    setResults(null)
    setError(null)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      {phase === "form" && (
        <StrategyForm onSubmit={handleSubmit} error={error} />
      )}
      {phase === "loading" && <LoadingScreen />}
      {phase === "results" && (
        <ResultsView results={results} onReset={handleReset} />
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
        This usually takes 30–60 seconds
      </p>
    </div>
  )
}