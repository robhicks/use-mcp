import { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';
export { Prompt, Resource, Tool } from '@modelcontextprotocol/sdk/types.js';

type UseMcpOptions = {
    /** The /sse URL of your remote MCP server */
    url: string;
    /** OAuth client name for registration (if dynamic registration is used) */
    clientName?: string;
    /** OAuth client URI for registration (if dynamic registration is used) */
    clientUri?: string;
    /** Custom callback URL for OAuth redirect (defaults to /oauth/callback on the current origin) */
    callbackUrl?: string;
    /** Storage key prefix for OAuth data in localStorage (defaults to "mcp:auth") */
    storageKeyPrefix?: string;
    /** Custom configuration for the MCP client identity */
    clientConfig?: {
        name?: string;
        version?: string;
    };
    /** Custom headers that can be used to bypass auth */
    customHeaders?: Record<string, string>;
    /** Whether to enable verbose debug logging to the console and the log state */
    debug?: boolean;
    /** Auto retry connection if initial connection fails, with delay in ms (default: false) */
    autoRetry?: boolean | number;
    /** Auto reconnect if an established connection is lost, with delay in ms (default: 3000) */
    autoReconnect?: boolean | number;
    /** Popup window features string (dimensions and behavior) for OAuth */
    popupFeatures?: string;
};
type UseMcpResult = {
    /** List of tools available from the connected MCP server */
    tools: Tool[];
    /** List of resources available from the connected MCP server */
    resources: Resource[];
    /** List of prompts available from the connected MCP server */
    prompts: Prompt[];
    /**
     * The current state of the MCP connection:
     * - 'discovering': Checking server existence and capabilities (including auth requirements).
     * - 'authenticating': Authentication is required and the process (e.g., popup) has been initiated.
     * - 'connecting': Establishing the SSE connection to the server.
     * - 'loading': Connected; loading resources like the tool list.
     * - 'ready': Connected and ready for tool calls.
     * - 'failed': Connection or authentication failed. Check the `error` property.
     */
    state: 'discovering' | 'authenticating' | 'connecting' | 'loading' | 'ready' | 'failed';
    /** If the state is 'failed', this provides the error message */
    error?: string;
    /**
     * If authentication requires user interaction (e.g., popup was blocked),
     * this URL can be presented to the user to complete authentication manually in a new tab.
     */
    authUrl?: string;
    /** Array of internal log messages (useful for debugging) */
    log: {
        level: 'debug' | 'info' | 'warn' | 'error';
        message: string;
        timestamp: number;
    }[];
    /**
     * Function to call a tool on the MCP server.
     * @param name The name of the tool to call.
     * @param args Optional arguments for the tool.
     * @returns A promise that resolves with the tool's result.
     * @throws If the client is not in the 'ready' state or the call fails.
     */
    callTool: (name: string, args?: Record<string, unknown>) => Promise<any>;
    /**
     * Function to list resources from the MCP server.
     * @param cursor Optional cursor for pagination.
     * @returns A promise that resolves with the list of resources.
     * @throws If the client is not in the 'ready' state or the call fails.
     */
    listResources: (cursor?: string) => Promise<any>;
    /**
     * Function to read a specific resource from the MCP server.
     * @param uri The URI of the resource to read.
     * @returns A promise that resolves with the resource contents.
     * @throws If the client is not in the 'ready' state or the call fails.
     */
    readResource: (uri: string) => Promise<any>;
    /**
     * Function to list prompts from the MCP server.
     * @param cursor Optional cursor for pagination.
     * @returns A promise that resolves with the list of prompts.
     * @throws If the client is not in the 'ready' state or the call fails.
     */
    listPrompts: (cursor?: string) => Promise<any>;
    /**
     * Function to get a specific prompt from the MCP server.
     * @param name The name of the prompt to get.
     * @returns A promise that resolves with the prompt.
     * @throws If the client is not in the 'ready' state or the call fails.
     */
    getPrompt: (name: string) => Promise<any>;
    /** Manually attempts to reconnect if the state is 'failed'. */
    retry: () => void;
    /** Disconnects the client from the MCP server. */
    disconnect: () => void;
    /**
     * Manually triggers the authentication process. Useful if the initial attempt failed
     * due to a blocked popup, allowing the user to initiate it via a button click.
     * @returns A promise that resolves with the authorization URL opened (or intended to be opened),
     *          or undefined if auth cannot be started.
     */
    authenticate: () => void;
    /** Clears all stored authentication data (tokens, client info, etc.) for this server URL from localStorage. */
    clearStorage: () => void;
};

declare function useMcp(options: UseMcpOptions): UseMcpResult;

export { type UseMcpOptions, type UseMcpResult, useMcp };
