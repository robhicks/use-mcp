import { OAuthClientMetadata, OAuthClientInformation, OAuthTokens, OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';

/**
 * Browser-compatible OAuth client provider for MCP using localStorage.
 */
declare class BrowserOAuthClientProvider implements OAuthClientProvider {
    readonly serverUrl: string;
    readonly storageKeyPrefix: string;
    readonly serverUrlHash: string;
    readonly clientName: string;
    readonly clientUri: string;
    readonly callbackUrl: string;
    constructor(serverUrl: string, options?: {
        storageKeyPrefix?: string;
        clientName?: string;
        clientUri?: string;
        callbackUrl?: string;
    });
    get redirectUrl(): string;
    get clientMetadata(): OAuthClientMetadata;
    clientInformation(): Promise<OAuthClientInformation | undefined>;
    saveClientInformation(clientInformation: OAuthClientInformation): Promise<void>;
    tokens(): Promise<OAuthTokens | undefined>;
    saveTokens(tokens: OAuthTokens): Promise<void>;
    saveCodeVerifier(codeVerifier: string): Promise<void>;
    codeVerifier(): Promise<string>;
    /**
     * Redirects the user agent to the authorization URL, storing necessary state.
     * This now adheres to the SDK's void return type expectation for the interface.
     * @param authorizationUrl The fully constructed authorization URL from the SDK.
     */
    redirectToAuthorization(authorizationUrl: URL): Promise<void>;
    /**
     * Retrieves the last URL passed to `redirectToAuthorization`. Useful for manual fallback.
     */
    getLastAttemptedAuthUrl(): string | null;
    clearStorage(): number;
    private hashString;
    getKey(keySuffix: string): string;
}

/**
 * Handles the OAuth callback using the SDK's auth() function.
 * Assumes it's running on the page specified as the callbackUrl.
 */
declare function onMcpAuthorization(): Promise<void>;

/**
 * Internal type for storing OAuth state in localStorage during the popup flow.
 * @internal
 */
interface StoredState {
    expiry: number;
    metadata?: OAuthMetadata;
    serverUrlHash: string;
    providerOptions: {
        serverUrl: string;
        storageKeyPrefix: string;
        clientName: string;
        clientUri: string;
        callbackUrl: string;
    };
}

export { BrowserOAuthClientProvider, type StoredState as InternalStoredState, onMcpAuthorization };
