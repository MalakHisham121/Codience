import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/GetRepoName.css";
import { useRepo } from "../hooks/useRepo";
import type { GitHubRepo } from "../types/GitHubRepo";
import {
  fetchUserRepos,
  storeOwnerNameFromRepoUrl,
} from "../services/repos.service";
import { connectGitHubApp } from "../services/githubApp.service";

const GetRepoName = () => {
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setRepo } = useRepo();
  const userName = localStorage.getItem("User") ?? "";

  const getRepoLabel = (repo: GitHubRepo) => {
    return repo.name;
  };

  useEffect(() => {
    if (!userName) {
      setError("No username found in local storage.");
      return;
    }

    const loadRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedRepos = await fetchUserRepos(userName, 1, 50);
        setRepos(fetchedRepos);
      } catch (err: any) {
        setError(err?.message || "Failed to load repositories.");
      } finally {
        setLoading(false);
      }
    };

    void loadRepos();
  }, [userName]);

  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return [];

    return repos.filter((repo) => {
      const repoName = repo.name?.toLowerCase() ?? "";

      return repoName.includes(search);
    });
  }, [query, repos]);

  const pickRepo = (repo: GitHubRepo) => {
    const repoName = getRepoLabel(repo);
    setSelectedRepo(repo);
    setQuery(repoName);
  };

  const submit = async () => {
    if (!selectedRepo) return;

    try {
      setLoading(true);
      setError(null);

      const repoName = getRepoLabel(selectedRepo);
      const parsedOwner =
        selectedRepo.html_url
          ? storeOwnerNameFromRepoUrl(selectedRepo.html_url)
          : selectedRepo.owner?.login ?? localStorage.getItem("ownerName") ?? userName;
      const owner =
        parsedOwner ||
        selectedRepo.owner?.login ||
        localStorage.getItem("ownerName") ||
        userName;

      if (owner) {
        localStorage.setItem("ownerName", owner);
      }

      setRepo(repoName);

      const appConnection = await connectGitHubApp({
        userName,
        owner,
        repo: repoName,
      });

      if (!appConnection.isInstalled) {
        if (appConnection.installUrl) {
          localStorage.setItem("GitHubAppInstallUrl", appConnection.installUrl);
        }

        navigate("/github-app-install", {
          state: {
            installUrl: appConnection.installUrl,
            message: appConnection.message,
          },
        });
        return;
      }

      navigate("/jira-login");
    } catch (err: any) {
      setError(err?.message || "Failed to connect GitHub App.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="getRepoName">
      <div className="repoNameContainer">
        <h3>Select Repo</h3>

        <div className="repoSearchBox">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setQuery(value);
              setSelectedRepo(null);
            }}
            placeholder="Repo Name..."
            aria-label="Search repositories"
            autoComplete="off"
          />

          {query.trim().length > 0 && (
            <div className="repoMenu" role="listbox" aria-label="Repository suggestions">
              {loading && <div className="repoMenuState">Loading repositories...</div>}
              {!loading && error && <div className="repoMenuState repoMenuError">{error}</div>}
              {!loading && !error && matches.length === 0 && (
                <div className="repoMenuState">No matching repositories found.</div>
              )}
              {!loading &&
                !error &&
                matches.map((repo) => {
                  const repoName = getRepoLabel(repo);

                  return (
                    <button
                      key={repo.id ?? repoName}
                      type="button"
                      className="repoMenuItem"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pickRepo(repo);
                      }}
                    >
                      <span className="repoMenuItemTitle">{repoName}</span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!selectedRepo || loading}
          className="reviewersAuthButton repoContinueButton"
        >
          {loading ? "Checking GitHub App..." : "Continue"}
        </button>

        {error && <div className="repoMenuState repoMenuError">{error}</div>}
      </div>
    </div>
  );
};

export default GetRepoName;
