import { StrictMode, Component } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import { ThemeProvider } from "./context/ThemeContext"

// ── Error Boundary ────────────────────────────────────────────────────────────
// React 18 in production silently unmounts the entire tree on any render error,
// leaving a blank screen with no feedback. This catches the crash, shows the
// error on screen (so you can read it without DevTools), and logs it to console.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error("[CogniLoad] Render crash:", error, info)
  }

  render() {
    if (this.state.error) {
      const msg   = this.state.error?.message ?? String(this.state.error)
      const stack = this.state.info?.componentStack ?? ""
      return (
        <div style={{
          padding: 32, fontFamily: "monospace", fontSize: 13,
          background: "#0a0a0a", color: "#f87171",
          minHeight: "100vh", whiteSpace: "pre-wrap", overflowY: "auto",
        }}>
          <div style={{ color: "#fb923c", fontWeight: "bold", fontSize: 16, marginBottom: 16 }}>
            ⚠ CogniLoad — render error
          </div>
          <div style={{ color: "#fca5a5", marginBottom: 12 }}>{msg}</div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>{stack}</div>
          <div style={{ marginTop: 24, color: "#9ca3af", fontSize: 11 }}>
            Open DevTools (F12) → Console for the full stack trace.
            {"\n"}Then report this text to diagnose the issue.
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const container = document.getElementById("root")

if (!container) {
  // If even #root is missing the page is broken at the HTML level
  document.body.innerHTML =
    '<div style="padding:32px;font-family:monospace;color:red">' +
    'ERROR: #root element not found. Check index.html.' +
    '</div>'
} else {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}