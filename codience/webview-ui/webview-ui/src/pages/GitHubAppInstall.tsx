import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./styles/GetRepoName.css";
import { getVsCodeApi, isVsCodeWebview } from "../services/vscodeApi";

interface GitHubAppInstallLocationState {
  installUrl?: string;
  message?: string;
}

const GitHubAppInstall = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as GitHubAppInstallLocationState | null;

  const installUrl = useMemo(
    () => state?.installUrl ?? localStorage.getItem("GitHubAppInstallUrl") ?? "",
    [state?.installUrl],
  );

  const message =
    state?.message ??
    "Install the GitHub App for this repository before continuing.";

  const handleInstall = () => {
    if (installUrl) {
      if (isVsCodeWebview()) {
        getVsCodeApi()?.postMessage({ command: "openExternal", url: installUrl });
      } else {
        window.location.assign(installUrl);
      }
    }

    navigate("/getRepo");
  };

  return (
    <div className="getRepoName">
      <div className="repoNameContainer githubAppInstallContainer">
        <h3>GitHub App Required</h3>
        <p className="githubAppInstallMessage">{message}</p>

        <button
          type="button"
          className="reviewersAuthButton repoContinueButton"
          onClick={handleInstall}
          disabled={!installUrl}
        >
          Install GitHub App
        </button>
      </div>
    </div>
  );
};

export default GitHubAppInstall;
