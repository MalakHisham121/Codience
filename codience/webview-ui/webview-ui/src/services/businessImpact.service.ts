import axios from "axios";
import type { PullRequest } from "../types/PullRequest";
import { getBusinessImpactConfig, getUserRepo, withOneRetry } from "./serviceUtils";

type BusinessImpactResponse = NonNullable<PullRequest["business_impact"]>;

const mapTier = (value: unknown): string => {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return "unknown";
};

const normalizeScore = (value: unknown): number | string => {
  if (typeof value === "number") return Number(value.toFixed(2));
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : value;
  }

  return "N/A";
};

const hasResolvedBusinessImpact = (
  businessImpact: PullRequest["business_impact"],
) =>
  Boolean(
    businessImpact &&
      businessImpact.weighted_score !== "Loading..." &&
      businessImpact.tier !== "loading",
  );

const parseBusinessImpact = (payload: unknown): BusinessImpactResponse => {
  if (!payload || typeof payload !== "object") {
    return {
      weighted_score: "N/A",
      tier: "unknown",
      ai_summary: "Business impact is unavailable.",
    };
  }

  const record = payload as Record<string, unknown>;
  const scoreBreakdown =
    record.score_breakdown && typeof record.score_breakdown === "object"
      ? (record.score_breakdown as BusinessImpactResponse["score_breakdown"])
      : undefined;

  return {
    weighted_score: normalizeScore(record.weighted_score),
    tier: mapTier(record.tier),
    should_block_merge:
      typeof record.should_block_merge === "boolean"
        ? record.should_block_merge
        : undefined,
    ai_summary:
      typeof record.ai_summary === "string" && record.ai_summary.trim()
        ? record.ai_summary
        : "No business impact summary returned.",
    score_breakdown: scoreBreakdown,
  };
};

export const fetchBusinessImpactForPR = async (
  prNumber: number,
): Promise<BusinessImpactResponse> => {
  const { userName, repoName } = getUserRepo();
  const ownerName = (localStorage.getItem("ownerName") ?? userName).trim();
  const businessImpactConfig = getBusinessImpactConfig();
  const businessImpactUrl = `http://127.0.0.1:8003/api/rank/pr/${encodeURIComponent(ownerName)}/${encodeURIComponent(repoName)}/${prNumber}/with-config`;
  const businessImpactRes = await withOneRetry(() =>
    axios.post(businessImpactUrl, businessImpactConfig),
  );

  return parseBusinessImpact(businessImpactRes.data);
};

export const enrichPRsWithBusinessImpact = async (
  prs: PullRequest[],
  onPRBusinessImpactResolved?: (updatedPR: PullRequest, index: number) => void,
): Promise<PullRequest[]> => {
  try {
    const prsWithBusinessImpact = [...prs];

    for (const [index, pr] of prs.entries()) {
      if (hasResolvedBusinessImpact(pr.business_impact)) {
        prsWithBusinessImpact[index] = pr;
        onPRBusinessImpactResolved?.(pr, index);
        continue;
      }

      let businessImpact: BusinessImpactResponse;

      try {
        businessImpact = await fetchBusinessImpactForPR(pr.number);
      } catch (businessImpactError: any) {
        console.error(
          `Failed to fetch business impact for PR #${pr.number}:`,
          businessImpactError?.message || businessImpactError,
        );
        businessImpact = {
          weighted_score: "N/A",
          tier: "unknown",
          ai_summary: "Business impact is unavailable.",
        };
      }

      const updatedPR: PullRequest = {
        ...prs[index],
        business_impact: businessImpact,
      };

      prsWithBusinessImpact[index] = updatedPR;
      onPRBusinessImpactResolved?.(updatedPR, index);
    }

    console.log("PR business impact enrichment finished:", prsWithBusinessImpact);

    return prsWithBusinessImpact;
  } catch (error: any) {
    console.error("Failed to enrich PR business impact:", error?.message || error);
    return prs;
  }
};

export default {
  fetchBusinessImpactForPR,
  enrichPRsWithBusinessImpact,
};
