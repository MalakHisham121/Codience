type VsCodeApi = {
  postMessage: (message: unknown) => void;
};

type VsCodeWindow = Window & {
  acquireVsCodeApi?: () => VsCodeApi;
  __codienceVsCodeApi?: VsCodeApi;
};

export const getVsCodeApi = (): VsCodeApi | null => {
  const webviewWindow = window as VsCodeWindow;

  if (webviewWindow.__codienceVsCodeApi) {
    return webviewWindow.__codienceVsCodeApi;
  }

  if (typeof webviewWindow.acquireVsCodeApi !== "function") {
    return null;
  }

  const api = webviewWindow.acquireVsCodeApi();
  webviewWindow.__codienceVsCodeApi = api;

  return api;
};

export const isVsCodeWebview = () =>
  typeof (window as VsCodeWindow).acquireVsCodeApi === "function";
