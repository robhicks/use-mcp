import {
  BrowserOAuthClientProvider
} from "../chunk-J6MO4N63.js";

// src/react/useMcp.ts
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  ListResourcesResultSchema,
  ListPromptsResultSchema,
  ReadResourceResultSchema,
  GetPromptResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";

// src/utils/assert.ts
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// src/react/useMcp.ts
var DEFAULT_RECONNECT_DELAY = 3e3;
var DEFAULT_RETRY_DELAY = 5e3;
var AUTH_TIMEOUT = 5 * 60 * 1e3;
function useMcp(options) {
  const {
    url,
    clientName,
    clientUri,
    callbackUrl = typeof window !== "undefined" ? new URL("/oauth/callback", window.location.origin).toString() : "/oauth/callback",
    storageKeyPrefix = "mcp:auth",
    clientConfig = {},
    customHeaders = {},
    debug = false,
    autoRetry = false,
    autoReconnect = DEFAULT_RECONNECT_DELAY
  } = options;
  const [state, setState] = useState("discovering");
  const [tools, setTools] = useState([]);
  const [resources, setResources] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState(void 0);
  const [log, setLog] = useState([]);
  const [authUrl, setAuthUrl] = useState(void 0);
  const clientRef = useRef(null);
  const transportRef = useRef(null);
  const authProviderRef = useRef(null);
  const connectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const connectAttemptRef = useRef(0);
  const authTimeoutRef = useRef(null);
  const stateRef = useRef(state);
  const autoReconnectRef = useRef(autoReconnect);
  const successfulTransportRef = useRef(null);
  useEffect(() => {
    stateRef.current = state;
    autoReconnectRef.current = autoReconnect;
  }, [state, autoReconnect]);
  const addLog = useCallback(
    (level, message, ...args) => {
      const fullMessage = args.length > 0 ? `${message} ${args.map((arg) => JSON.stringify(arg)).join(" ")}` : message;
      console[level](`[useMcp] ${fullMessage}`);
      if (isMountedRef.current) {
        setLog((prevLog) => [...prevLog.slice(-100), { level, message: fullMessage, timestamp: Date.now() }]);
      }
    },
    []
    // Empty dependency array makes this stable
  );
  const disconnect = useCallback(
    async (quiet = false) => {
      if (!quiet) addLog("info", "Disconnecting...");
      connectingRef.current = false;
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
      const transport = transportRef.current;
      clientRef.current = null;
      transportRef.current = null;
      if (isMountedRef.current && !quiet) {
        setState("discovering");
        setTools([]);
        setResources([]);
        setPrompts([]);
        setError(void 0);
        setAuthUrl(void 0);
      }
      if (transport) {
        try {
          await transport.close();
          if (!quiet) addLog("debug", "Transport closed");
        } catch (err) {
          if (!quiet) addLog("warn", "Error closing transport:", err);
        }
      }
    },
    [addLog]
    // Depends only on stable addLog
  );
  const failConnection = useCallback(
    (errorMessage, connectionError) => {
      addLog("error", errorMessage, connectionError ?? "");
      if (isMountedRef.current) {
        setState("failed");
        setError(errorMessage);
        const manualUrl = authProviderRef.current?.getLastAttemptedAuthUrl();
        if (manualUrl) {
          setAuthUrl(manualUrl);
          addLog("info", "Manual authentication URL may be available.", manualUrl);
        }
      }
      connectingRef.current = false;
    },
    [addLog]
  );
  const connect = useCallback(async () => {
    if (connectingRef.current) {
      addLog("debug", "Connection attempt already in progress.");
      return;
    }
    if (!isMountedRef.current) {
      addLog("debug", "Connect called after unmount, aborting.");
      return;
    }
    connectingRef.current = true;
    connectAttemptRef.current += 1;
    setError(void 0);
    setAuthUrl(void 0);
    successfulTransportRef.current = null;
    setState("discovering");
    addLog("info", `Connecting attempt #${connectAttemptRef.current} to ${url}...`);
    if (!authProviderRef.current) {
      authProviderRef.current = new BrowserOAuthClientProvider(url, {
        storageKeyPrefix,
        clientName,
        clientUri,
        callbackUrl
      });
      addLog("debug", "BrowserOAuthClientProvider initialized in connect.");
    }
    if (!clientRef.current) {
      clientRef.current = new Client(
        { name: clientConfig.name || "use-mcp-react-client", version: clientConfig.version || "0.1.0" },
        { capabilities: {} }
      );
      addLog("debug", "MCP Client initialized in connect.");
    }
    const tryConnectWithTransport = async (transportType) => {
      addLog("info", `Attempting connection with ${transportType.toUpperCase()} transport...`);
      if (stateRef.current !== "authenticating") {
        setState("connecting");
      }
      let transportInstance;
      try {
        assert(authProviderRef.current, "Auth Provider must be initialized");
        assert(clientRef.current, "Client must be initialized");
        if (transportRef.current) {
          await transportRef.current.close().catch((e) => addLog("warn", `Error closing previous transport: ${e.message}`));
          transportRef.current = null;
        }
        const commonOptions = {
          authProvider: authProviderRef.current,
          requestInit: { headers: customHeaders }
        };
        const targetUrl = new URL(url);
        if (transportType === "http") {
          transportInstance = new StreamableHTTPClientTransport(targetUrl, commonOptions);
        } else {
          transportInstance = new SSEClientTransport(targetUrl, commonOptions);
        }
        transportRef.current = transportInstance;
        addLog("debug", `${transportType.toUpperCase()} transport created.`);
      } catch (err) {
        failConnection(
          `Failed to create ${transportType.toUpperCase()} transport: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : void 0
        );
        return "failed";
      }
      transportInstance.onmessage = (message) => {
        addLog("debug", `[Transport] Received: ${JSON.stringify(message)}`);
        clientRef.current?.handleMessage(message);
      };
      transportInstance.onerror = (err) => {
        failConnection(`Transport error (${transportType.toUpperCase()}): ${err.message}`, err);
      };
      transportInstance.onclose = () => {
        if (!isMountedRef.current || connectingRef.current) return;
        addLog("info", `Transport connection closed (${successfulTransportRef.current || "unknown"} type).`);
        const currentState = stateRef.current;
        const currentAutoReconnect = autoReconnectRef.current;
        if (currentState === "ready" && currentAutoReconnect) {
          const delay = typeof currentAutoReconnect === "number" ? currentAutoReconnect : DEFAULT_RECONNECT_DELAY;
          addLog("info", `Attempting to reconnect in ${delay}ms...`);
          setState("connecting");
          setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        } else if (currentState !== "failed" && currentState !== "authenticating") {
          failConnection("Connection closed unexpectedly.");
        }
      };
      try {
        addLog("info", `Connecting client via ${transportType.toUpperCase()}...`);
        await clientRef.current.connect(transportInstance);
        addLog("info", `Client connected via ${transportType.toUpperCase()}. Loading tools, resources, and prompts...`);
        successfulTransportRef.current = transportType;
        setState("loading");
        const [toolsResponse, resourcesResponse, promptsResponse] = await Promise.allSettled([
          clientRef.current.request({ method: "tools/list" }, ListToolsResultSchema),
          clientRef.current.request({ method: "resources/list" }, ListResourcesResultSchema),
          clientRef.current.request({ method: "prompts/list" }, ListPromptsResultSchema)
        ]);
        if (isMountedRef.current) {
          if (toolsResponse.status === "fulfilled") {
            setTools(toolsResponse.value.tools);
            addLog("info", `Loaded ${toolsResponse.value.tools.length} tools.`);
          } else {
            addLog("warn", `Failed to load tools: ${toolsResponse.reason}`);
            setTools([]);
          }
          if (resourcesResponse.status === "fulfilled") {
            setResources(resourcesResponse.value.resources);
            addLog("info", `Loaded ${resourcesResponse.value.resources.length} resources.`);
          } else {
            addLog("warn", `Failed to load resources: ${resourcesResponse.reason}`);
            setResources([]);
          }
          if (promptsResponse.status === "fulfilled") {
            setPrompts(promptsResponse.value.prompts);
            addLog("info", `Loaded ${promptsResponse.value.prompts.length} prompts.`);
          } else {
            addLog("warn", `Failed to load prompts: ${promptsResponse.reason}`);
            setPrompts([]);
          }
          setState("ready");
          connectAttemptRef.current = 0;
          return "success";
        } else {
          return "failed";
        }
      } catch (connectErr) {
        addLog("debug", `Client connect error via ${transportType.toUpperCase()}:`, connectErr);
        const errorInstance = connectErr instanceof Error ? connectErr : new Error(String(connectErr));
        const errorMessage = errorInstance.message;
        const is404 = errorMessage.includes("404") || errorMessage.includes("Not Found");
        const is405 = errorMessage.includes("405") || errorMessage.includes("Method Not Allowed");
        const isLikelyCors = errorMessage === "Failed to fetch" || errorMessage === "NetworkError when attempting to fetch resource." || errorMessage === "Load failed";
        if (transportType === "http" && (is404 || is405 || isLikelyCors)) {
          addLog("warn", `HTTP transport failed (${isLikelyCors ? "CORS" : is404 ? "404" : "405"}). Will attempt fallback to SSE.`);
          return "fallback";
        }
        if (errorInstance instanceof UnauthorizedError || errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
          addLog("info", "Authentication required. Initiating SDK auth flow...");
          if (stateRef.current !== "authenticating") {
            setState("authenticating");
            if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = setTimeout(() => {
            }, AUTH_TIMEOUT);
          }
          try {
            assert(authProviderRef.current, "Auth Provider not available for auth flow");
            const authResult = await auth(authProviderRef.current, { serverUrl: url });
            if (!isMountedRef.current) return "failed";
            if (authResult === "AUTHORIZED") {
              addLog("info", "Authentication successful via existing token or refresh. Re-attempting connection...");
              if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
              connectingRef.current = false;
              connect();
              return "failed";
            } else if (authResult === "REDIRECT") {
              addLog("info", "Redirecting for authentication. Waiting for callback...");
              return "auth_redirect";
            }
          } catch (sdkAuthError) {
            if (!isMountedRef.current) return "failed";
            if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
            addLog("error", "Auth flow failed:", sdkAuthError);
            if (transportType === "http") {
              return "fallback";
            } else {
              failConnection(
                `Failed to initiate authentication: ${sdkAuthError instanceof Error ? sdkAuthError.message : String(sdkAuthError)}`,
                sdkAuthError instanceof Error ? sdkAuthError : void 0
              );
              return "failed";
            }
          }
        }
        if (transportType === "http") {
          addLog("warn", `HTTP transport failed: ${errorMessage}. Will attempt fallback to SSE.`);
          return "fallback";
        } else {
          failConnection(`Failed to connect via ${transportType.toUpperCase()}: ${errorMessage}`, errorInstance);
          return "failed";
        }
      }
    };
    let finalStatus = "failed";
    const httpResult = await tryConnectWithTransport("http");
    if (httpResult === "fallback" && isMountedRef.current && stateRef.current !== "authenticating") {
      const sseResult = await tryConnectWithTransport("sse");
      finalStatus = sseResult;
    } else {
      finalStatus = httpResult;
    }
    if (finalStatus === "fallback") {
      finalStatus = "failed";
      failConnection("All transport methods failed");
    }
    if (finalStatus === "success" || finalStatus === "failed") {
      connectingRef.current = false;
    }
    addLog("debug", `Connection sequence finished with status: ${finalStatus}`);
  }, [
    // Stable callback dependencies
    addLog,
    failConnection,
    disconnect,
    auth,
    // Include SDK auth function if used directly
    // Configuration dependencies
    url,
    storageKeyPrefix,
    clientName,
    clientUri,
    callbackUrl,
    clientConfig.name,
    clientConfig.version
    // No state/autoReconnect dependency here
  ]);
  const callTool = useCallback(
    async (name, args) => {
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(`MCP client is not ready (current state: ${state}). Cannot call tool "${name}".`);
      }
      addLog("info", `Calling tool: ${name}`, args);
      try {
        const result = await clientRef.current.request({ method: "tools/call", params: { name, arguments: args } }, CallToolResultSchema);
        addLog("info", `Tool "${name}" call successful:`, result);
        return result;
      } catch (err) {
        addLog("error", `Error calling tool "${name}": ${err instanceof Error ? err.message : String(err)}`, err);
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        if (errorInstance instanceof UnauthorizedError || errorInstance.message.includes("Unauthorized") || errorInstance.message.includes("401")) {
          addLog("warn", "Tool call unauthorized, attempting re-authentication...");
          setState("authenticating");
          if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = setTimeout(() => {
          }, AUTH_TIMEOUT);
          try {
            assert(authProviderRef.current, "Auth Provider not available for tool re-auth");
            const authResult = await auth(authProviderRef.current, { serverUrl: url });
            if (!isMountedRef.current) return;
            if (authResult === "AUTHORIZED") {
              addLog("info", "Re-authentication successful. Retrying tool call is recommended, or reconnecting.");
              if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
              connectingRef.current = false;
              connect();
            } else if (authResult === "REDIRECT") {
              addLog("info", "Redirecting for re-authentication for tool call.");
            }
          } catch (sdkAuthError) {
            if (!isMountedRef.current) return;
            if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
            failConnection(
              `Re-authentication failed: ${sdkAuthError instanceof Error ? sdkAuthError.message : String(sdkAuthError)}`,
              sdkAuthError instanceof Error ? sdkAuthError : void 0
            );
          }
        }
        if (stateRef.current !== "authenticating") {
          throw err;
        }
        return void 0;
      }
    },
    [state, url, addLog, failConnection, connect]
    // Depends on state for error message, url, and stable callbacks
  );
  const listResources = useCallback(
    async (cursor) => {
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(`MCP client is not ready (current state: ${state}). Cannot list resources.`);
      }
      addLog("info", `Listing resources${cursor ? ` with cursor: ${cursor}` : ""}`);
      try {
        const result = await clientRef.current.request(
          { method: "resources/list", params: cursor ? { cursor } : {} },
          ListResourcesResultSchema
        );
        addLog("info", `Listed ${result.resources.length} resources.`);
        return result;
      } catch (err) {
        addLog("error", `Error listing resources: ${err instanceof Error ? err.message : String(err)}`, err);
        throw err;
      }
    },
    [state, addLog, failConnection, connect]
  );
  const readResource = useCallback(
    async (uri) => {
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(`MCP client is not ready (current state: ${state}). Cannot read resource "${uri}".`);
      }
      addLog("info", `Reading resource: ${uri}`);
      try {
        const result = await clientRef.current.request({ method: "resources/read", params: { uri } }, ReadResourceResultSchema);
        addLog("info", `Resource "${uri}" read successfully.`);
        return result;
      } catch (err) {
        addLog("error", `Error reading resource "${uri}": ${err instanceof Error ? err.message : String(err)}`, err);
        throw err;
      }
    },
    [state, addLog, failConnection, connect]
  );
  const listPrompts = useCallback(
    async (cursor) => {
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(`MCP client is not ready (current state: ${state}). Cannot list prompts.`);
      }
      addLog("info", `Listing prompts${cursor ? ` with cursor: ${cursor}` : ""}`);
      try {
        const result = await clientRef.current.request(
          { method: "prompts/list", params: cursor ? { cursor } : {} },
          ListPromptsResultSchema
        );
        addLog("info", `Listed ${result.prompts.length} prompts.`);
        return result;
      } catch (err) {
        addLog("error", `Error listing prompts: ${err instanceof Error ? err.message : String(err)}`, err);
        throw err;
      }
    },
    [state, addLog, failConnection, connect]
  );
  const getPrompt = useCallback(
    async (name) => {
      if (stateRef.current !== "ready" || !clientRef.current) {
        throw new Error(`MCP client is not ready (current state: ${state}). Cannot get prompt "${name}".`);
      }
      addLog("info", `Getting prompt: ${name}`);
      try {
        const result = await clientRef.current.request({ method: "prompts/get", params: { name } }, GetPromptResultSchema);
        addLog("info", `Prompt "${name}" retrieved successfully.`);
        return result;
      } catch (err) {
        addLog("error", `Error getting prompt "${name}": ${err instanceof Error ? err.message : String(err)}`, err);
        throw err;
      }
    },
    [state, addLog, failConnection, connect]
  );
  const retry = useCallback(() => {
    if (stateRef.current === "failed") {
      addLog("info", "Retry requested...");
      connect();
    } else {
      addLog("warn", `Retry called but state is not 'failed' (state: ${stateRef.current}). Ignoring.`);
    }
  }, [addLog, connect]);
  const authenticate = useCallback(() => {
    addLog("info", "Manual authentication requested...");
    const currentState = stateRef.current;
    if (currentState === "failed") {
      addLog("info", "Attempting to reconnect and authenticate via retry...");
      retry();
    } else if (currentState === "authenticating") {
      addLog("warn", "Already attempting authentication. Check for blocked popups or wait for timeout.");
      const manualUrl = authProviderRef.current?.getLastAttemptedAuthUrl();
      if (manualUrl && !authUrl) {
        setAuthUrl(manualUrl);
        addLog("info", "Manual authentication URL retrieved:", manualUrl);
      }
    } else {
      addLog(
        "info",
        `Client not in a state requiring manual authentication trigger (state: ${currentState}). If needed, try disconnecting and reconnecting.`
      );
    }
  }, [addLog, retry, authUrl]);
  const clearStorage = useCallback(() => {
    if (authProviderRef.current) {
      const count = authProviderRef.current.clearStorage();
      addLog("info", `Cleared ${count} item(s) from localStorage for ${url}.`);
      setAuthUrl(void 0);
      disconnect();
    } else {
      addLog("warn", "Auth provider not initialized, cannot clear storage.");
    }
  }, [url, addLog, disconnect]);
  useEffect(() => {
    const messageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "mcp_auth_callback") {
        addLog("info", "Received auth callback message.", event.data);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
        if (event.data.success) {
          addLog("info", "Authentication successful via popup. Reconnecting client...");
          connectingRef.current = false;
          connect();
        } else {
          failConnection(`Authentication failed in callback: ${event.data.error || "Unknown reason."}`);
        }
      }
    };
    window.addEventListener("message", messageHandler);
    addLog("debug", "Auth callback message listener added.");
    return () => {
      window.removeEventListener("message", messageHandler);
      addLog("debug", "Auth callback message listener removed.");
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, [addLog, failConnection, connect]);
  useEffect(() => {
    isMountedRef.current = true;
    addLog("debug", "useMcp mounted, initiating connection.");
    connectAttemptRef.current = 0;
    if (!authProviderRef.current || authProviderRef.current.serverUrl !== url) {
      authProviderRef.current = new BrowserOAuthClientProvider(url, {
        storageKeyPrefix,
        clientName,
        clientUri,
        callbackUrl
      });
      addLog("debug", "BrowserOAuthClientProvider initialized/updated on mount/option change.");
    }
    connect();
    return () => {
      isMountedRef.current = false;
      addLog("debug", "useMcp unmounting, disconnecting.");
      disconnect(true);
    };
  }, [
    url,
    storageKeyPrefix,
    callbackUrl,
    clientName,
    clientUri,
    clientConfig.name,
    clientConfig.version,
    connect,
    disconnect
    // Stable callbacks
  ]);
  useEffect(() => {
    let retryTimeoutId = null;
    if (state === "failed" && autoRetry && connectAttemptRef.current > 0) {
      const delay = typeof autoRetry === "number" ? autoRetry : DEFAULT_RETRY_DELAY;
      addLog("info", `Connection failed, auto-retrying in ${delay}ms...`);
      retryTimeoutId = setTimeout(() => {
        if (isMountedRef.current && stateRef.current === "failed") {
          retry();
        }
      }, delay);
    }
    return () => {
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [state, autoRetry, retry, addLog]);
  return {
    state,
    tools,
    resources,
    prompts,
    error,
    log,
    authUrl,
    callTool,
    retry,
    disconnect,
    authenticate,
    clearStorage,
    listResources,
    readResource,
    listPrompts,
    getPrompt
  };
}
export {
  useMcp
};
