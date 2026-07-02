import axios from "axios";
import type { GitHubProfile } from "../types/GitHubProfile";

const PROFILE_URL = "http://localhost:5051/api/GitHubProfiling";

export const fetchGitHubProfile = async (
  username: string,
): Promise<GitHubProfile> => {
  const response = await axios.get<GitHubProfile>(
    `${PROFILE_URL}/${encodeURIComponent(username)}`,
  );

  return response.data;
};

export default { fetchGitHubProfile };