import axios from "axios";
import type { PullRequest } from "../types/PullRequest";
import { getUserRepo, withOneRetry } from "./serviceUtils";

const fetchPRFilesChangedCount = async (
  userName: string,
  repoName: string,
  prNumber: number,
): Promise<number> => {
  const filesUrl = `https://codience.onrender.com/api/GitHubAuth/${encodeURIComponent(userName)}/${encodeURIComponent(repoName)}/pulls/${prNumber}/files`;

  const response = await withOneRetry(() => axios.get(filesUrl));

  if (!Array.isArray(response.data)) {
    return 0;
  }

  return response.data.length;
};

const fetchPRFilesChangedCountWithRetry = async (
  userName: string,
  repoName: string,
  prNumber: number,
) => withOneRetry(() => fetchPRFilesChangedCount(userName, repoName, prNumber));

export const normalizePullRequest = (pr: any): PullRequest => ({
  ...pr,
  number: Number(pr.number ?? pr.prNumber ?? pr.pullRequestNumber ?? 0),
  title: String(pr.title ?? ""),
  state: String(pr.state ?? "open").toLowerCase(),
  name: String(pr.name ?? pr.repositoryName ?? pr.repoName ?? pr.repository ?? ""),
  createdAt:
    pr.createdAt ??
    (pr.created_at === "0001-01-01T00:00:00" || !pr.created_at
      ? new Date().toLocaleDateString("en-GB")
      : new Date(pr.created_at).toLocaleDateString("en-GB")),
  files_changed: pr.files_changed ?? "Loading...",
  risk:
    pr.risk ??
    ({
      risk_score: "Loading...",
      risk_level: "loading",
      comments: 0,
      files_changed: pr.files_changed ?? "Loading...",
    } as PullRequest["risk"]),
  business_impact:
    pr.business_impact ??
    ({
      weighted_score: "Loading...",
      tier: "loading",
      ai_summary: "Loading...",
    } as PullRequest["business_impact"]),
});

export const fetchPRs = async (): Promise<PullRequest[]> => {
  const { userName, repoName } = getUserRepo();

  const url = `http://localhost:5051/api/GitHubAuth/${userName}/${repoName}/pulls`;


  try {
    const res = await axios.get(url);

    const normalizedPRs = res.data.map(normalizePullRequest);

    console.log("PRs fetched:", normalizedPRs);

    return normalizedPRs as PullRequest[];
  } catch (error: any) {
    console.error("Failed to fetch PRs:", error?.message || error);
    throw new Error("Failed to fetch pull requests");
  }
};

export const enrichPRsWithFilesChanged = async (
  prs: PullRequest[],
  onPRFilesChangedResolved?: (updatedPR: PullRequest, index: number) => void,
): Promise<PullRequest[]> => {
  const { userName, repoName } = getUserRepo();

  try {
    const prsWithFilesChanged = [...prs];

    for (const [index, pr] of prs.entries()) {
      try {
        const filesChanged = await fetchPRFilesChangedCountWithRetry(
          userName,
          repoName,
          pr.number,
        );

        const updatedPR: PullRequest = {
          ...prs[index],
          files_changed: filesChanged,
          risk: prs[index].risk
            ? {
                ...prs[index].risk,
                files_changed: filesChanged,
              }
            : prs[index].risk,
        };

        prsWithFilesChanged[index] = updatedPR;
        onPRFilesChangedResolved?.(updatedPR, index);
      } catch (filesError: any) {
        console.error(
          `Failed to fetch changed files for PR #${pr.number}:`,
          filesError?.message || filesError,
        );

        const updatedPR: PullRequest = {
          ...prs[index],
          files_changed: "Error",
          risk: prs[index].risk
            ? {
                ...prs[index].risk,
                files_changed: "Error",
              }
            : prs[index].risk,
        };

        prsWithFilesChanged[index] = updatedPR;
        onPRFilesChangedResolved?.(updatedPR, index);
      }
    }

    return prsWithFilesChanged;
  } catch (error: any) {
    console.error("Failed to enrich PR files changed:", error?.message || error);
    return prs;
  }
};

export default {
  fetchPRs,
  enrichPRsWithFilesChanged,
};
