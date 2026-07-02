
import axios from "axios";
import type { DeviceCodeResponse } from "../types/DeviceCode";
import type { Token } from "../types/Token";


export async function exchangeDeviceCode(
  deviceData: DeviceCodeResponse,
): Promise<Token> {
  const url = "https://codience.onrender.com/api/GitHubAuth/token";
  const res = await axios.post<Token>(url, deviceData, {
    validateStatus: () => true,
  });

  if (res.status === 200) return res.data;
  throw new Error(`Token exchange failed with status ${res.status}`);
}

export async function fetchDeviceCode(): Promise<DeviceCodeResponse> {
  const url = "https://codience.onrender.com/api/GitHubAuth/device-code";
  const res = await axios.get<DeviceCodeResponse>(url);
  if (res.status === 200) return res.data;
  throw new Error(`Failed to fetch device code: ${res.status}`);
}
