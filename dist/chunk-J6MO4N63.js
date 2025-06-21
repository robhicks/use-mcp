// src/auth/browser-provider.ts
var BrowserOAuthClientProvider = class {
  serverUrl;
  storageKeyPrefix;
  serverUrlHash;
  clientName;
  clientUri;
  callbackUrl;
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.storageKeyPrefix = options.storageKeyPrefix || "mcp:auth";
    this.serverUrlHash = this.hashString(serverUrl);
    this.clientName = options.clientName || "MCP Browser Client";
    this.clientUri = options.clientUri || (typeof window !== "undefined" ? window.location.origin : "");
    this.callbackUrl = options.callbackUrl || (typeof window !== "undefined" ? new URL("/oauth/callback", window.location.origin).toString() : "/oauth/callback");
  }
  // --- SDK Interface Methods ---
  get redirectUrl() {
    return this.callbackUrl;
  }
  get clientMetadata() {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: "none",
      // Public client
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: this.clientName,
      client_uri: this.clientUri
      // scope: 'openid profile email mcp', // Example scopes, adjust as needed
    };
  }
  async clientInformation() {
    const key = this.getKey("client_info");
    const data = localStorage.getItem(key);
    if (!data) return void 0;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn(`[${this.storageKeyPrefix}] Failed to parse client information:`, e);
      localStorage.removeItem(key);
      return void 0;
    }
  }
  // NOTE: The SDK's auth() function uses this if dynamic registration is needed.
  // Ensure your OAuthClientInformationFull matches the expected structure if DCR is used.
  async saveClientInformation(clientInformation) {
    const key = this.getKey("client_info");
    localStorage.setItem(key, JSON.stringify(clientInformation));
  }
  async tokens() {
    const key = this.getKey("tokens");
    const data = localStorage.getItem(key);
    if (!data) return void 0;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn(`[${this.storageKeyPrefix}] Failed to parse tokens:`, e);
      localStorage.removeItem(key);
      return void 0;
    }
  }
  async saveTokens(tokens) {
    const key = this.getKey("tokens");
    localStorage.setItem(key, JSON.stringify(tokens));
    localStorage.removeItem(this.getKey("code_verifier"));
    localStorage.removeItem(this.getKey("last_auth_url"));
  }
  async saveCodeVerifier(codeVerifier) {
    const key = this.getKey("code_verifier");
    localStorage.setItem(key, codeVerifier);
  }
  async codeVerifier() {
    const key = this.getKey("code_verifier");
    const verifier = localStorage.getItem(key);
    if (!verifier) {
      throw new Error(
        `[${this.storageKeyPrefix}] Code verifier not found in storage for key ${key}. Auth flow likely corrupted or timed out.`
      );
    }
    return verifier;
  }
  /**
   * Redirects the user agent to the authorization URL, storing necessary state.
   * This now adheres to the SDK's void return type expectation for the interface.
   * @param authorizationUrl The fully constructed authorization URL from the SDK.
   */
  async redirectToAuthorization(authorizationUrl) {
    const state = crypto.randomUUID();
    const stateKey = `${this.storageKeyPrefix}:state_${state}`;
    const stateData = {
      serverUrlHash: this.serverUrlHash,
      expiry: Date.now() + 1e3 * 60 * 10,
      // State expires in 10 minutes
      // Store provider options needed to reconstruct on callback
      providerOptions: {
        serverUrl: this.serverUrl,
        storageKeyPrefix: this.storageKeyPrefix,
        clientName: this.clientName,
        clientUri: this.clientUri,
        callbackUrl: this.callbackUrl
      }
    };
    localStorage.setItem(stateKey, JSON.stringify(stateData));
    authorizationUrl.searchParams.set("state", state);
    const authUrlString = authorizationUrl.toString();
    localStorage.setItem(this.getKey("last_auth_url"), authUrlString);
    const popupFeatures = "width=600,height=700,resizable=yes,scrollbars=yes,status=yes";
    try {
      const popup = window.open(authUrlString, `mcp_auth_${this.serverUrlHash}`, popupFeatures);
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        console.warn(
          `[${this.storageKeyPrefix}] Popup likely blocked by browser. Manual navigation might be required using the stored URL.`
        );
      } else {
        popup.focus();
        console.info(`[${this.storageKeyPrefix}] Redirecting to authorization URL in popup.`);
      }
    } catch (e) {
      console.error(`[${this.storageKeyPrefix}] Error opening popup window:`, e);
    }
  }
  // --- Helper Methods ---
  /**
   * Retrieves the last URL passed to `redirectToAuthorization`. Useful for manual fallback.
   */
  getLastAttemptedAuthUrl() {
    return localStorage.getItem(this.getKey("last_auth_url"));
  }
  clearStorage() {
    const prefixPattern = `${this.storageKeyPrefix}_${this.serverUrlHash}_`;
    const statePattern = `${this.storageKeyPrefix}:state_`;
    const keysToRemove = [];
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(prefixPattern)) {
        keysToRemove.push(key);
      } else if (key.startsWith(statePattern)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const state = JSON.parse(item);
            if (state.serverUrlHash === this.serverUrlHash) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          console.warn(`[${this.storageKeyPrefix}] Error parsing state key ${key} during clearStorage:`, e);
        }
      }
    }
    const uniqueKeysToRemove = [...new Set(keysToRemove)];
    uniqueKeysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      count++;
    });
    return count;
  }
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  getKey(keySuffix) {
    return `${this.storageKeyPrefix}_${this.serverUrlHash}_${keySuffix}`;
  }
};

export {
  BrowserOAuthClientProvider
};
