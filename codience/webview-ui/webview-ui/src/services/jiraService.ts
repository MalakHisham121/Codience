import axios from "axios";
import type { JiraLoginResponse } from "../types/JiraAuth";
import type { JiraExchangeResponse } from "../types/JiraAuth";

const JIRA_LOGIN_URL = "http://127.0.0.1:5051/api/Jira/login";
const JIRA_EXCHANGE_URL = "http://127.0.0.1:5051/api/Jira/exchange";

type JiraLoginState = "webapp" | "vscode";

export const jiraService = {
  async fetchLoginUrl(state: JiraLoginState = "webapp"): Promise<string> {
    const response = await axios.get<JiraLoginResponse>(JIRA_LOGIN_URL, {
      params: { state },
    });

    if (!response.data?.url) {
      throw new Error("Jira login response did not include a redirect URL.");
    }

    return response.data.url;
  },

  async exchangeCode(code: string): Promise<JiraExchangeResponse> {
    const response = await axios.post<JiraExchangeResponse>(JIRA_EXCHANGE_URL, {
      code,
    });

    if (!response.data.accessToken || !response.data.cloudId) {
      throw new Error("Jira exchange response did not include token data.");
    }

    return response.data;
  },

  storeSession(data: JiraExchangeResponse) {
    localStorage.setItem("JiraAccessToken", data.accessToken);
    localStorage.setItem("JiraCloudId", data.cloudId);
  },

  storeProjectKey(projectKey: string) {
    localStorage.setItem("JiraProjectKey", projectKey);
  },

  clearSession() {
    localStorage.removeItem("JiraAccessToken");
    localStorage.removeItem("JiraCloudId");
    localStorage.removeItem("JiraProjectKey");
  },

  getCodeFromSearch(search: string = window.location.search) {
    return new URLSearchParams(search).get("code");
  },
};

export default jiraService;