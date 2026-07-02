import axios from "axios";
import type { PullRequest } from "../types/PullRequest";
import { getUserRepo, withOneRetry } from "./serviceUtils";

type OrchestrateRisk = {
  risk_score?: number | string;
  risk_level?: string;
  comments?: number;
  files_changed?: number | string;
};

const mapRiskLevel = (value: unknown): string => {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return "unknown";
};

const normalizeRiskScore = (value: unknown): number | string => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  return "N/A";
};

const hasResolvedRisk = (risk: PullRequest["risk"]) =>
  Boolean(
    risk &&
      risk.risk_score !== "Loading..." &&
      risk.risk_level !== "loading",
  );

const parseOrchestrateRisk = (payload: unknown): OrchestrateRisk => {
  if (!payload || typeof payload !== "object") {
    return { risk_score: "N/A", risk_level: "unknown" };
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.bug_probability === "number") {
    const probability = Math.max(0, Math.min(1, record.bug_probability));
    const score = Number((probability * 100).toFixed(2));
    const risk_level =
      probability < 0.33 ? "low" : probability < 0.66 ? "medium" : "high";

    return {
      risk_score: score,
      risk_level,
    };
  }

  const nestedRisk =
    record.risk && typeof record.risk === "object"
      ? (record.risk as Record<string, unknown>)
      : null;

  const risk_score = normalizeRiskScore(
    nestedRisk?.risk_score ?? record.risk_score ?? record.score,
  );
  const risk_level = mapRiskLevel(
    nestedRisk?.risk_level ?? record.risk_level ?? record.level,
  );

  return {
    risk_score,
    risk_level,
    comments:
      (nestedRisk?.comments as number | undefined) ??
      (record.comments as number | undefined),
    files_changed:
      (nestedRisk?.files_changed as number | undefined) ??
      (record.files_changed as number | undefined),
  };
};

export const fetchRiskForPR = async (prNumber: number): Promise<OrchestrateRisk> => {
  const { userName, repoName } = getUserRepo();
  const riskUrl = `http://127.0.0.1:8001/orchestrate/${encodeURIComponent(userName)}/${encodeURIComponent(repoName)}/${prNumber}`;
  const riskRes = await withOneRetry(() => axios.get(riskUrl));

  return parseOrchestrateRisk(riskRes.data);
};

export const enrichPRsWithRisk = async (
  prs: PullRequest[],
  onPRRiskResolved?: (updatedPR: PullRequest, index: number) => void,
): Promise<PullRequest[]> => {
  try {
    const prsWithRisk = [...prs];

    for (const [index, pr] of prs.entries()) {
      if (hasResolvedRisk(pr.risk)) {
        prsWithRisk[index] = pr;
        onPRRiskResolved?.(pr, index);
        continue;
      }

      let risk: OrchestrateRisk;

      try {
        risk = await fetchRiskForPR(pr.number);
      } catch (riskError: any) {
        console.error(
          `Failed to fetch risk for PR #${pr.number}:`,
          riskError?.message || riskError,
        );
        risk = { risk_score: "N/A", risk_level: "unknown" };
      }

      const updatedPR: PullRequest = {
        ...prs[index],
        risk: {
          risk_score: risk.risk_score ?? "N/A",
          risk_level: risk.risk_level ?? "unknown",
          comments: risk.comments ?? 0,
          files_changed: prs[index].files_changed ?? risk.files_changed ?? 0,
        },
      };

      prsWithRisk[index] = updatedPR;
      onPRRiskResolved?.(updatedPR, index);
    }

    console.log("PR risk enrichment finished:", prsWithRisk);

    return prsWithRisk;
  } catch (error: any) {
    console.error("Failed to enrich PR risks:", error?.message || error);
    return prs;
  }
};

export default {
  fetchRiskForPR,
  enrichPRsWithRisk,
};
