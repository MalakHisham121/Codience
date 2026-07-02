export interface GitHubAppConnectResponse {
  isInstalled: boolean;
  isAdmin: boolean;
  message: string;
  installUrl?: string;
}

export interface GitHubAppConnectParams {
  userName: string;
  owner: string;
  repo: string;
}