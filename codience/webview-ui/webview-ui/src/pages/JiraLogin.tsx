import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/JiraLogin.css";
import jiraService from "../services/jiraService.ts";

type JiraAuthMessage = {
  type?: string;
  code?: string;
};

const isVsCodeWebview = () =>
  typeof (window as Window & { acquireVsCodeApi?: () => unknown }).acquireVsCodeApi ===
  "function";

type VsCodeApi = {
  postMessage: (message: unknown) => void;
};

const JiraLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exchangeStartedRef = useRef(false);
  const vscodeApiRef = useRef<VsCodeApi | null>(null);

  const exchangeCode = async (code: string) => {
    if (exchangeStartedRef.current) {
      return;
    }

    exchangeStartedRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await jiraService.exchangeCode(code);

      jiraService.storeSession(data);

      navigate("/jira-project", {
        state: {
          projects: data.projects ?? [],
        },
      });
    } catch (exchangeError: any) {
      exchangeStartedRef.current = false;
      setError(exchangeError?.message || "Failed to exchange Jira authorization code.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const state = isVsCodeWebview() ? "vscode" : "webapp";
      const url = await jiraService.fetchLoginUrl(state);

      if (state === "vscode") {
        if (!vscodeApiRef.current) {
          const acquireVsCodeApi = (window as Window & {
            acquireVsCodeApi?: () => VsCodeApi;
          }).acquireVsCodeApi;

          if (typeof acquireVsCodeApi === "function") {
            vscodeApiRef.current = acquireVsCodeApi();
          }
        }

        vscodeApiRef.current?.postMessage({ command: "openExternal", url });
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

  useEffect(() => {
    const searchForCode = () => {
      const code = jiraService.getCodeFromSearch();

      if (code) {
        void exchangeCode(code);
        return true;
      }

      return false;
    };

    if (searchForCode()) {
      return;
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = event.data as JiraAuthMessage;

      if (message.type === "jiraAuthCode" && message.code) {
        void exchangeCode(message.code);
      }
    };

    window.addEventListener("message", handleMessage);

    const intervalId = window.setInterval(() => {
      searchForCode();
    }, 500);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

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