import { useEffect, useState } from "react";
import {
  enrichPRsWithFilesChanged,
  fetchPRs,
  normalizePullRequest,
} from "../services/prs.service";
import { enrichPRsWithBusinessImpact } from "../services/businessImpact.service";
import { enrichPRsWithRisk } from "../services/risk.service";
import { subscribeToPullRequestCreated } from "../services/pullRequestsHub.service";
import type { PullRequest } from "../types/PullRequest";

type PRCache = {
  data: PullRequest[] | null;
  loading: boolean;
  error: string | null;
  promise: Promise<PullRequest[]> | null;
  repo: string | null;
  subscribers: Set<() => void>;
};

const prCache: PRCache = {
  data: null,
  loading: true,
  error: null,
  promise: null,
  repo: null,
  subscribers: new Set(),
};

let livePRUnsubscribe: (() => void) | null = null;
let livePRRepoKey: string | null = null;

const emitPRCacheUpdate = () => {
  prCache.subscribers.forEach((subscriber) => subscriber());
};

const resetPRCache = () => {
  livePRUnsubscribe?.();
  livePRUnsubscribe = null;
  livePRRepoKey = null;

  setPRCache({
    data: null,
    loading: true,
    error: null,
    promise: null,
    repo: null,
  });
};

const setPRCache = (next: Partial<Pick<PRCache, "data" | "loading" | "error" | "promise" | "repo">>) => {
  Object.assign(prCache, next);
  emitPRCacheUpdate();
};

const isResolvedFilesChanged = (value: PullRequest["files_changed"]) =>
  typeof value === "number" || value === "Error";

const isResolvedRisk = (risk: PullRequest["risk"]) =>
  Boolean(
    risk &&
      risk.risk_score !== "Loading..." &&
      risk.risk_level !== "loading",
  );

const isResolvedBusinessImpact = (businessImpact: PullRequest["business_impact"]) =>
  Boolean(
    businessImpact &&
      businessImpact.weighted_score !== "Loading..." &&
      businessImpact.tier !== "loading",
  );

const mergePRCacheItem = (updatedPR: PullRequest) => {
  if (!prCache.data) return;

  setPRCache({
    data: prCache.data.map((pr) => {
      if (pr.number !== updatedPR.number) return pr;

      const nextFilesChanged = isResolvedFilesChanged(pr.files_changed)
        ? pr.files_changed
        : updatedPR.files_changed;

      const riskSource =
        isResolvedRisk(updatedPR.risk) || !isResolvedRisk(pr.risk)
          ? updatedPR.risk ?? pr.risk
          : pr.risk;

      const businessImpactSource =
        isResolvedBusinessImpact(updatedPR.business_impact) ||
        !isResolvedBusinessImpact(pr.business_impact)
          ? updatedPR.business_impact ?? pr.business_impact
          : pr.business_impact;

      const mergedRisk = {
        risk_score: riskSource?.risk_score ?? "N/A",
        risk_level: riskSource?.risk_level ?? "unknown",
        comments: riskSource?.comments ?? pr.risk?.comments ?? 0,
        files_changed: nextFilesChanged,
      };

      return {
        ...pr,
        ...updatedPR,
        files_changed: nextFilesChanged,
        risk: mergedRisk,
        business_impact:
          businessImpactSource ?? {
            weighted_score: "N/A",
            tier: "unknown",
            ai_summary: "Business impact is unavailable.",
          },
      };
    }),
  });
};

const upsertPRCacheItem = (updatedPR: PullRequest) => {
  if (!prCache.data) {
    setPRCache({ data: [updatedPR] });
    return;
  }

  const existingIndex = prCache.data.findIndex((pr) => pr.number === updatedPR.number);

  if (existingIndex === -1) {
    setPRCache({ data: [updatedPR, ...prCache.data] });
    return;
  }

  mergePRCacheItem(updatedPR);
};

const enrichNewPullRequest = (pr: PullRequest) => {
  const filesPromise = enrichPRsWithFilesChanged([pr], (updatedPR) => {
    mergePRCacheItem(updatedPR);
  }).catch((filesErr) => {
    console.error("Files changed enrichment failed:", filesErr);
  });

  const riskPromise = enrichPRsWithRisk([pr], (updatedPR) => {
    mergePRCacheItem(updatedPR);
  }).catch((riskErr) => {
    console.error("Risk enrichment failed:", riskErr);
  });

  const businessImpactPromise = enrichPRsWithBusinessImpact([pr], (updatedPR) => {
    mergePRCacheItem(updatedPR);
  }).catch((businessImpactErr) => {
    console.error("Business impact enrichment failed:", businessImpactErr);
  });

  void Promise.allSettled([filesPromise, riskPromise, businessImpactPromise]);
};

const getGitHubAppRegistrationId = () =>
  "95bbca99-517c-4832-8e58-9ac26ed13c6e";

const ensureLivePRSubscription = () => {
  const repo = localStorage.getItem("RepoName");
  const userName = localStorage.getItem("User");
  const owner = localStorage.getItem("ownerName") ?? userName;

  if (!repo || !userName || !owner) {
    return;
  }

  const repoKey = `${owner}/${repo}`;

  if (livePRRepoKey === repoKey && livePRUnsubscribe) {
    return;
  }

  livePRUnsubscribe?.();
  livePRUnsubscribe = null;
  livePRRepoKey = repoKey;

  void subscribeToPullRequestCreated(
    {
      userId: getGitHubAppRegistrationId(),
      owner,
      repo,
    },
    (payload) => {
      const newPR = normalizePullRequest(payload);
      upsertPRCacheItem(newPR);
      enrichNewPullRequest(newPR);
    },
  )
    .then((unsubscribe) => {
      if (livePRRepoKey !== repoKey) {
        unsubscribe();
        return;
      }

      livePRUnsubscribe = unsubscribe;
    })
    .catch((err) => {
      if (livePRRepoKey === repoKey) {
        livePRRepoKey = null;
      }

      console.error("Failed to subscribe to pull request updates:", err);
    });
};

export const usePRs = () => {
  const [data, setData] = useState<PullRequest[] | null>(prCache.data);
  const [loading, setLoading] = useState(prCache.loading);
  const [error, setError] = useState<string | null>(prCache.error);

  const syncFromCache = () => {
    setData(prCache.data);
    setLoading(prCache.loading);
    setError(prCache.error);
  };

  const load = async (force = false) => {
    const currentRepo = localStorage.getItem("RepoName");

    if (!force && prCache.repo && currentRepo && prCache.repo !== currentRepo) {
      force = true;
    }

    if (!force) {
      if (prCache.data) {
        syncFromCache();
        return prCache.data;
      }

      if (prCache.promise) {
        syncFromCache();
        return prCache.promise;
      }
    }

    if (force) {
      setPRCache({ data: null, loading: true, error: null, promise: null, repo: null });
    } else {
      setPRCache({ loading: true, error: null });
    }

    const request = (async () => {
      try {
        const res = await fetchPRs();

        setPRCache({ data: res, loading: false, error: null, repo: currentRepo ?? null });
        ensureLivePRSubscription();

        const filesPromise = enrichPRsWithFilesChanged(res, (updatedPR) => {
          mergePRCacheItem(updatedPR);
        }).catch((filesErr) => {
          console.error("Files changed enrichment failed:", filesErr);
        });

        const riskPromise = enrichPRsWithRisk(res, (updatedPR) => {
          mergePRCacheItem(updatedPR);
        }).catch((riskErr) => {
          console.error("Risk enrichment failed:", riskErr);
        });

        const businessImpactPromise = enrichPRsWithBusinessImpact(res, (updatedPR) => {
          mergePRCacheItem(updatedPR);
        }).catch((businessImpactErr) => {
          console.error("Business impact enrichment failed:", businessImpactErr);
        });

        void Promise.allSettled([filesPromise, riskPromise, businessImpactPromise]);

        return res;
      } catch (err) {
        setPRCache({ error: "Failed to load PRs", loading: false });
        throw err;
      } finally {
        setPRCache({ promise: null });
      }
    })();

    setPRCache({ promise: request });
    return request;
  };

  useEffect(() => {
    syncFromCache();
    prCache.subscribers.add(syncFromCache);

    const handleRepoChange = (_e: Event) => {
      void load(true);
    };

    window.addEventListener("repoChanged", handleRepoChange);

    void load();

    return () => {
      prCache.subscribers.delete(syncFromCache);
      window.removeEventListener("repoChanged", handleRepoChange);
    };
  }, []);

  return { data, loading, error, reload: load };
};

export const clearPRState = resetPRCache;

export default usePRs;
