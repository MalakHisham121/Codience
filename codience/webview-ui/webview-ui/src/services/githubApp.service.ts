import axios from "axios";
import type { GitHubAppConnectParams } from "../types/GitHubInstallation";
import type { GitHubAppConnectResponse } from "../types/GitHubInstallation";

const GITHUB_APP_CONNECT_URL = "http://localhost:5051/api/GitHubApp/connect";



export const connectGitHubApp = async ({
  userName,
  owner,
  repo,
}: GitHubAppConnectParams): Promise<GitHubAppConnectResponse> => {
  const response = await axios.get<GitHubAppConnectResponse>(
    GITHUB_APP_CONNECT_URL,
    {
      params: { userName, owner, repo },
    },
  );

  const data = response.data;

  return {
    isInstalled: Boolean(data.isInstalled ?? data.isInstalled),
    isAdmin: Boolean(data.isAdmin ?? data.isAdmin),
    message: data.message ?? "",
    installUrl: data.installUrl ?? data.installUrl,
  };
};
