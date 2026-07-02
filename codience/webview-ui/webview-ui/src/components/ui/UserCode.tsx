import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { DeviceCodeResponse } from "../../types/DeviceCode";
import {
  fetchDeviceCode,
  exchangeDeviceCode,
} from "../../services/auth.service";
import "../styles/DeviceCodeCard.css";
import copyIcon from "../../assets/copy_icon.png";

const DeviceCodeCard = () => {
  const navigate = useNavigate();

  const [deviceData, setDeviceData] = useState<DeviceCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!deviceData) return;

    await navigator.clipboard.writeText(deviceData.user_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  useEffect(() => {
    const runAuthFlow = async () => {
      try {
        setLoading(true);
        setError(null);

        const deviceResponse = await fetchDeviceCode();
        setDeviceData(deviceResponse);
        const token = await exchangeDeviceCode(deviceResponse);
        localStorage.setItem("User", token.login);
        navigate("/getRepo");
      } catch (err: any) {
        setError(err?.message || "Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    runAuthFlow();
  }, [navigate]);

  return (
    <div className="deviceCodeContainer">
      <p>User Code</p>

      {deviceData && (
        <>
          <div className="userCodeRow">
            <p className="userCode userCodeValue">
              {deviceData.user_code}
            </p>
            <button
              type="button"
              className="copyDeviceCodeButton"
              onClick={handleCopy}
              aria-label="Copy device code"
              title={copied ? "Copied" : "Copy device code"}
              data-copied={copied}
            >
              <img
                src={copyIcon}
                alt=""
                aria-hidden="true"
                className="copyDeviceCodeIcon"
              />
            </button>
          </div>

          <div className="linksContainer">
            <a
              href={deviceData.verification_uri}
              target="_blank"
              className="signInLink"
              rel="noreferrer"
            >
              Open Verification Page
            </a>
          </div>
        </>
      )}

      {loading && <p>Loading authentication...</p>}

      {error && <p className="errorText">{error}</p>}
    </div>
  );
};

export default DeviceCodeCard;
