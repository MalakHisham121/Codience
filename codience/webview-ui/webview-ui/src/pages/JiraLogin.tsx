import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/JiraLogin.css";
import jiraService from "../services/jiraService.ts";
import { getVsCodeApi, isVsCodeWebview } from "../services/vscodeApi";

const JiraLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string>("");

  const addDebug = (msg: string) => setDebugMsg((prev) => prev + "\n" + msg);

  const exchangeCode = async (code: string) => {
    try {
      addDebug(`Exchanging code: ${code.substring(0, 5)}...`);
      setLoading(true);
      setError(null);
      const data = await jiraService.exchangeCode(code);
      addDebug("Exchange success!");
      jiraService.storeSession(data);
      jiraService.storeProjects(data.projects ?? []);
      navigate("/jira-project", {
        state: {
          projects: data.projects ?? [],
        },
      });
    } catch (err: any) {
      addDebug(`Exchange error: ${err?.message}`);
      setError(err?.message || "Failed to complete Jira authentication.");
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      addDebug(`Received message type: ${message?.type}`);
      if (message.type === "jiraAuthCode" && message.code) {
        addDebug("Processing jiraAuthCode...");
        exchangeCode(message.code);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!isVsCodeWebview()) {
      const code = jiraService.getCodeFromSearch();
      if (code) {
        addDebug("Found code in URL");
        exchangeCode(code);
      }
    } else {
      addDebug("Running in VS Code Webview mode");
    }
  }, []);

  const handleLogin = async () => {
    try {
      addDebug("Starting login...");
      setLoading(true);
      setError(null);

      const state = isVsCodeWebview() ? "vscode" : "webapp";
      const url = await jiraService.fetchLoginUrl(state);
      addDebug(`Login URL fetched, state: ${state}`);

      if (state === "vscode") {
        addDebug("Posting openExternal message");
        getVsCodeApi()?.postMessage({ command: "openExternal", url });
        return;
      }

      window.location.assign(url);
    } catch (loginError: any) {
      addDebug(`Login error: ${loginError?.message}`);
      setError(loginError?.message || "Failed to start Jira login.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticateLater = () => {
    jiraService.clearSession();
    navigate("/home");
  };

  const [manualCode, setManualCode] = useState("");

  const handleManualSubmit = () => {
    let input = manualCode.trim();
    if (!input) return;

    if (input.includes("auth.atlassian.com/authorize")) {
      setError("You pasted the authorization URL. Please login using that URL in your browser, then copy the 'code' parameter from the URL you are redirected to.");
      return;
    }

    let codeToExchange = input;
    if (input.includes("code=")) {
      try {
        const url = new URL(input);
        const extracted = url.searchParams.get("code");
        if (extracted) {
          codeToExchange = extracted;
        }
      } catch (e) {
        const match = input.match(/[?&]code=([^&]+)/);
        if (match) {
          codeToExchange = match[1];
        }
      }
    }

    addDebug("Manual code submitted: " + codeToExchange.substring(0, 5) + "...");
    exchangeCode(codeToExchange);
  };

  return (
    <div className="jiraLoginPage">
      <div className="deviceCodeContainer">
        <button
          type="button"
          className="jiraLoginButton"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Working..." : "Continue to Jira"}
        </button>

        <button
          type="button"
          className="jiraLoginSecondaryButton"
          onClick={handleAuthenticateLater}
          disabled={loading}
        >
          Authenticate with Jira later
        </button>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <p style={{ fontSize: '12px', color: 'gray', margin: 0 }}>If automatic redirect fails, paste your code here:</p>
          <input 
            type="text" 
            value={manualCode} 
            onChange={(e) => setManualCode(e.target.value)} 
            placeholder="Paste authorization code..." 
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)' }}
          />
          <button 
            type="button" 
            className="jiraLoginSecondaryButton" 
            onClick={handleManualSubmit}
            disabled={!manualCode.trim() || loading}
          >
            Submit Code
          </button>
        </div>

        {error && <p className="errorText">{error}</p>}
        
        {debugMsg && (
          <pre style={{ marginTop: 20, fontSize: 10, textAlign: 'left', whiteSpace: 'pre-wrap', color: 'gray' }}>
            {debugMsg}
          </pre>
        )}
      </div>
    </div>
  );
};

export default JiraLogin;