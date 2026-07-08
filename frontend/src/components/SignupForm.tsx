import { useState } from "react"

interface SignupFormProps {
  onSuccess: () => void
  onSwitchToLogin: () => void
}

export default function SignupForm({ onSuccess, onSwitchToLogin }: SignupFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    try {
        const res = await fetch("http://localhost:8000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
        })
        if (!res.ok) {
        const err = await res.json()
        const message = extractErrorMessage(err)
        throw new Error(message)
        }
        onSuccess()
    } catch (e) {
        setError(e instanceof Error ? e.message : "Signup failed")
    }
    }

    function extractErrorMessage(err: any): string {
    if (typeof err.detail === "string") {
        return err.detail
    }
    if (Array.isArray(err.detail) && err.detail.length > 0) {
        // FastAPI/Pydantic validation error format
        return err.detail.map((d: any) => d.msg).join(", ")
    }
    return "Signup failed"
    }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: "2rem"
    }}>
      <div style={{
        width: "100%", maxWidth: "400px",
        background: "#1e293b", borderRadius: "16px",
        padding: "2.5rem", border: "1px solid #334155",
      }}>
        <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.4rem", color:"#f1f5f9"}}>Sign Up</h1>

        {error && (
          <div style={{
            background: "#450a0a", border: "1px solid #991b1b",
            borderRadius: "8px", padding: "0.75rem 1rem",
            marginBottom: "1.25rem", color: "#fca5a5", fontSize: "0.9rem"
          }}>
            {error}
          </div>
        )}

        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ ...inputStyle, marginTop: "0.75rem" }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, marginTop: "0.75rem" }}
        />

        <button onClick={handleSubmit} style={{ ...buttonStyle, marginTop: "1.25rem" }}>
          Create Account
        </button>

        <p style={{ marginTop: "1.25rem", fontSize: "0.85rem", color: "#64748b", textAlign: "center" }}>
          Already have an account?{" "}
          <span onClick={onSwitchToLogin} style={{ color: "#3b82f6", cursor: "pointer" }}>
            Login
          </span>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.75rem 1rem",
  background: "#0f172a", border: "1px solid #334155",
  borderRadius: "8px", color: "#f1f5f9",
  fontSize: "0.95rem", boxSizing: "border-box", outline: "none",
}

const buttonStyle: React.CSSProperties = {
  width: "100%", padding: "0.85rem",
  background: "#3b82f6", color: "#fff",
  border: "none", borderRadius: "8px",
  fontSize: "1rem", fontWeight: 600, cursor: "pointer",
}