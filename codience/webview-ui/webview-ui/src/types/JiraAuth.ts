
export interface JiraLoginResponse {
  url?: string;
}

export interface JiraProject {
  key: string;
  name: string;
}

export interface JiraExchangeResponse {
  accessToken: string;
  cloudId: string;
  projects?: JiraProject[];
}