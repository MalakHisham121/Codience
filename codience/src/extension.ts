import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const provider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider),
  );

  // Register a URI handler so external OAuth redirects (vscode://.../?code=...)
  // can be forwarded back to the webview.
  const uriHandler = vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      try {
        if (uri.path !== "/callback" && uri.path !== "/jira-login") {
          return;
        }

        const params = new URLSearchParams(uri.query);
        const code = params.get("code");
        if (!code) {
          return;
        }

        // forward to the provider (if it has an active webview)
        provider.handleIncomingUri(code, uri.toString());
      } catch (err) {
        console.error("Failed to handle incoming URI", err);
      }
    },
  });
  context.subscriptions.push(uriHandler);
}

export function deactivate() {}

class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sidebarView";

  private _webviewView?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // Called by the activate() URI handler to push the code back into the webview
  public handleIncomingUri(code: string | null, fullUri?: string) {
    if (!this._webviewView) {
      return;
    }
    this._webviewView.webview.postMessage({
      type: "jiraAuthCode",
      code,
      uri: fullUri,
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._webviewView = webviewView;
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "webview-ui", "webview-ui", "dist"),
      ],
    };

    try {
      const indexPath = path.join(
        this._extensionUri.fsPath,
        "webview-ui",
        "webview-ui",
        "dist",
        "index.html",
      );

      let html = fs.readFileSync(indexPath, "utf-8");

      html = html.replace(
        /(src|href)="(.+?)"/g,
        (_match: string, attr: string, link: string) => {
          if (/^https?:\/\//.test(link)) {
            return _match;
          }

          const uri = webview.asWebviewUri(
            vscode.Uri.joinPath(
              this._extensionUri,
              "webview-ui",
              "webview-ui",
              "dist",
              link,
            ),
          );

          return `${attr}="${uri}"`;
        },
      );

      html = html.replace(
        "<head>",
        `<head>
      <meta http-equiv="Content-Security-Policy"
        content="
          default-src 'none';
          img-src ${webview.cspSource} https:;
          style-src ${webview.cspSource} 'unsafe-inline';
          script-src ${webview.cspSource};
          connect-src
            https://codience.onrender.com
            https://sphery-arlen-nondecorative.ngrok-free.dev
            https://fordless-samella-unexpendable.ngrok-free.dev
            http://localhost:5051
            http://127.0.0.1:5051
            http://localhost:8000
            http://127.0.0.1:8000
            http://127.0.0.1:8001
            http://127.0.0.1:8002
            http://127.0.0.1:8003;
        ">
    `,
      );

      webview.html = html;
    } catch (err: any) {
      console.error("Error loading webview index.html:", err);
      webview.html = `<!DOCTYPE html>
      <html>
        <body>
          <h2>Error loading webview</h2>
          <pre>${err.message}</pre>
          <pre>${err.stack}</pre>
        </body>
      </html>`;
    }

    // Wire messages from the webview:
    // - openExternal: extension will open the external browser for OAuth
    webview.onDidReceiveMessage((message) => {
      try {
        if (!message || typeof message !== "object") {
          return;
        }
        if (message.command === "openExternal" && message.url) {
          let url = String(message.url);
          if (url.includes("state=vscode") && vscode.env.uriScheme !== "vscode") {
            url = url.replace("state=vscode", `state=vscode-${vscode.env.uriScheme}`);
          }
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
      } catch (err) {
        console.error("Error handling message from webview:", err);
      }
    });

    // Clear stored webview when disposed
    webviewView.onDidDispose(() => {
      this._webviewView = undefined;
    });
  }
}