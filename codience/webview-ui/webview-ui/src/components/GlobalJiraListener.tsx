import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jiraService from "../services/jiraService";

type JiraAuthMessage = {
  type?: string;
  code?: string;
};

const GlobalJiraListener = () => {
  const navigate = useNavigate();
  const exchangeStartedRef = useRef(false);

  useEffect(() => {
    const exchangeCode = async (code: string) => {
      if (exchangeStartedRef.current) {
        return;
      }
      exchangeStartedRef.current = true;
      try {
        const data = await jiraService.exchangeCode(code);
        
        // Use the existing jiraService to store tokens
        jiraService.storeSession(data);
        
        // Optionally also store directly as requested by the plan
        localStorage.setItem("jiraToken", data.accessToken);
        
        alert("Jira connected successfully!");
        
        navigate("/jira-project", {
          state: {
            projects: data.projects ?? [],
          },
        });
      } catch (error) {
        console.error("Failed to connect Jira", error);
      } finally {
        exchangeStartedRef.current = false;
      }
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = event.data as JiraAuthMessage;
      if (message.type === "jiraAuthCode" && message.code) {
        void exchangeCode(message.code);
      }
    };

    window.addEventListener("message", handleMessage);

    // Keep the polling for local dev (webapp) in case we need it,
    // although the plan says for web app it redirects to /callback
    const searchForCode = () => {
      const code = jiraService.getCodeFromSearch();
      if (code) {
        void exchangeCode(code);
        return true;
      }
      return false;
    };

    const intervalId = window.setInterval(() => {
      searchForCode();
    }, 500);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("message", handleMessage);
    };
  }, [navigate]);

  return null;
};

export default GlobalJiraListener;
