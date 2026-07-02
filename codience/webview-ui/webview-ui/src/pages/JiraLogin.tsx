import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/JiraLogin.css";
import jiraService from "../services/jiraService.ts";
import { getVsCodeApi, isVsCodeWebview } from "../services/vscodeApi";

const JiraLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const state = isVsCodeWebview() ? "vscode" : "webapp";
      const url = await jiraService.fetchLoginUrl(state);

      if (state === "vscode") {
        getVsCodeApi()?.postMessage({ command: "openExternal", url });
        return;
      }

      window.location.assign(url);
    } catch (loginError: any) {
      setError(loginError?.message || "Failed to start Jira login.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticateLater = () => {
    jiraService.clearSession();
    navigate("/home");
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
          {loading ? "Opening Jira..." : "Continue to Jira"}
        </button>

        <button
          type="button"
          className="jiraLoginSecondaryButton"
          onClick={handleAuthenticateLater}
          disabled={loading}
        >
          Authenticate with Jira later
        </button>

        {error && <p className="errorText">{error}</p>}
      </div>
    </div>
  );
};

export default JiraLogin;