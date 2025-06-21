import {
  BrowserOAuthClientProvider
} from "./chunk-J6MO4N63.js";

// src/auth/callback.ts
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
async function onMcpAuthorization() {
  const queryParams = new URLSearchParams(window.location.search);
  const code = queryParams.get("code");
  const state = queryParams.get("state");
  const error = queryParams.get("error");
  const errorDescription = queryParams.get("error_description");
  const logPrefix = "[mcp-callback]";
  console.log(`${logPrefix} Handling callback...`, { code, state, error, errorDescription });
  let provider = null;
  let storedStateData = null;
  const stateKey = state ? `mcp:auth:state_${state}` : null;
  try {
    if (error) {
      throw new Error(`OAuth error: ${error} - ${errorDescription || "No description provided."}`);
    }
    if (!code) {
      throw new Error("Authorization code not found in callback query parameters.");
    }
    if (!state || !stateKey) {
      throw new Error("State parameter not found or invalid in callback query parameters.");
    }
    const storedStateJSON = localStorage.getItem(stateKey);
    if (!storedStateJSON) {
      throw new Error(`Invalid or expired state parameter "${state}". No matching state found in storage.`);
    }
    try {
      storedStateData = JSON.parse(storedStateJSON);
    } catch (e) {
      throw new Error("Failed to parse stored OAuth state.");
    }
    if (!storedStateData.expiry || storedStateData.expiry < Date.now()) {
      localStorage.removeItem(stateKey);
      throw new Error("OAuth state has expired. Please try initiating authentication again.");
    }
    if (!storedStateData.providerOptions) {
      throw new Error("Stored state is missing required provider options.");
    }
    const { serverUrl, ...providerOptions } = storedStateData.providerOptions;
    console.log(`${logPrefix} Re-instantiating provider for server: ${serverUrl}`);
    provider = new BrowserOAuthClientProvider(serverUrl, providerOptions);
    console.log(`${logPrefix} Calling SDK auth() to exchange code...`);
    const authResult = await auth(provider, { serverUrl, authorizationCode: code });
    if (authResult === "AUTHORIZED") {
      console.log(`${logPrefix} Authorization successful via SDK auth(). Notifying opener...`);
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "mcp_auth_callback", success: true }, window.location.origin);
        window.close();
      } else {
        console.warn(`${logPrefix} No opener window detected. Redirecting to root.`);
        window.location.href = "/";
      }
      localStorage.removeItem(stateKey);
    } else {
      console.warn(`${logPrefix} SDK auth() returned unexpected status: ${authResult}`);
      throw new Error(`Unexpected result from authentication library: ${authResult}`);
    }
  } catch (err) {
    console.error(`${logPrefix} Error during OAuth callback handling:`, err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "mcp_auth_callback", success: false, error: errorMessage }, window.location.origin);
    }
    try {
      document.body.innerHTML = `
            <div style="font-family: sans-serif; padding: 20px;">
            <h1>Authentication Error</h1>
            <p style="color: red; background-color: #ffebeb; border: 1px solid red; padding: 10px; border-radius: 4px;">
                ${errorMessage}
            </p>
            <p>You can close this window or <a href="#" onclick="window.close(); return false;">click here to close</a>.</p>
            <pre style="font-size: 0.8em; color: #555; margin-top: 20px; white-space: pre-wrap;">${err instanceof Error ? err.stack : ""}</pre>
            </div>
        `;
    } catch (displayError) {
      console.error(`${logPrefix} Could not display error in callback window:`, displayError);
    }
    if (stateKey) {
      localStorage.removeItem(stateKey);
    }
    if (provider) {
      localStorage.removeItem(provider.getKey("code_verifier"));
      localStorage.removeItem(provider.getKey("last_auth_url"));
    }
  }
}
export {
  BrowserOAuthClientProvider,
  onMcpAuthorization
};
