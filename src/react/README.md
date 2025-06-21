# use-mcp React Integration

This package provides the `useMcp` hook for easily integrating the Model Context Protocol (MCP) into your React applications.

## Installation

Ensure you have `use-mcp`, `@modelcontextprotocol/sdk`, `react`, and `react-dom` installed:

```bash
npm install use-mcp @modelcontextprotocol/sdk react react-dom
# or
yarn add use-mcp @modelcontextprotocol/sdk react react-dom
# or
pnpm add use-mcp @modelcontextprotocol/sdk react react-dom
```

## useMcp Hook

The useMcp hook manages the connection to an MCP server, handles authentication (including OAuth), and provides access to tools, resources, and prompts with functions to interact with the server.

## Importing

```tsx
import { useMcp } from 'use-mcp/react'
// Optional: Import types if needed
import type { UseMcpOptions, UseMcpResult, Tool, Resource, Prompt } from 'use-mcp/react'
```

## Usage

```tsx
import React from 'react'
import { useMcp } from 'use-mcp/react'
import { useChat } from 'ai/react' // Example integration with Vercel AI SDK

function MyChatComponent() {
  const mcp = useMcp({
    // Replace with your MCP server's SSE endpoint URL
    url: 'http://localhost:8080/sse',
    // Optional: Configure OAuth parameters if your server requires auth
    // clientName: 'My Awesome App',
    // clientUri: window.location.origin,
    // callbackUrl: `${window.location.origin}/oauth/callback`, // Must match your callback route
    // storageKeyPrefix: 'my_app_mcp_auth', // Customize localStorage keys
    debug: process.env.NODE_ENV === 'development', // Enable debug logs in dev
    autoReconnect: true, // Automatically reconnect if connection drops
    autoRetry: 5000, // Retry connection every 5s if initial connection fails
  })

  // Example: Using MCP tools with Vercel AI SDK's useChat
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat', // Your backend endpoint that talks to the LLM
    // Pass MCP tools to the AI SDK if the connection is ready
    tools: mcp.state === 'ready' ? mcp.tools : undefined,
    // Example: Handling tool calls made by the LLM
    async onToolCall({ toolCall }) {
      if (mcp.state !== 'ready') {
        console.error('MCP not ready, cannot handle tool call:', toolCall)
        // Return an error or indication that the tool cannot be called
        return {
          toolCallId: toolCall.toolCallId,
          result: { error: 'Tool provider not available' },
        }
      }
      try {
        console.log('Handling tool call via MCP:', toolCall)
        const result = await mcp.callTool(toolCall.toolName, toolCall.args)
        return {
          toolCallId: toolCall.toolCallId,
          result,
        }
      } catch (error) {
        console.error('Error calling MCP tool:', error)
        return {
          toolCallId: toolCall.toolCallId,
          result: { error: error instanceof Error ? error.message : String(error) },
        }
      }
    },
  })

  // Example: Using MCP resources
  const handleResourceExample = async () => {
    if (mcp.state === 'ready') {
      try {
        // List available resources
        const resourcesList = await mcp.listResources()
        console.log('Available resources:', resourcesList.resources)
        
        // Read a specific resource
        if (resourcesList.resources.length > 0) {
          const resource = await mcp.readResource(resourcesList.resources[0].uri)
          console.log('Resource contents:', resource)
        }
      } catch (error) {
        console.error('Error accessing resources:', error)
      }
    }
  }

  // Example: Using MCP prompts
  const handlePromptExample = async () => {
    if (mcp.state === 'ready') {
      try {
        // List available prompts
        const promptsList = await mcp.listPrompts()
        console.log('Available prompts:', promptsList.prompts)
        
        // Get a specific prompt
        if (promptsList.prompts.length > 0) {
          const prompt = await mcp.getPrompt(promptsList.prompts[0].name)
          console.log('Prompt details:', prompt)
        }
      } catch (error) {
        console.error('Error accessing prompts:', error)
      }
    }
  }

  return (
    <div>
      <h1>MCP Status: {mcp.state}</h1>
      {mcp.state === 'failed' && (
        <div style={{ color: 'red' }}>
          Error: {mcp.error}
          {/* Show manual auth link if popup was blocked */}
          {mcp.authUrl && (
            <p>
              Popup blocked?{' '}
              <a href={mcp.authUrl} target="_blank" rel="noopener noreferrer">
                Authenticate manually
              </a>
              {' or '}
              <button onClick={() => mcp.authenticate()}>Retry Auth</button>
            </p>
          )}
          {/* Show retry button for general failures */}
          {!mcp.authUrl && <button onClick={mcp.retry}>Retry Connection</button>}
        </div>
      )}
      {mcp.state === 'authenticating' && <p>Waiting for authentication...</p>}
      {mcp.state === 'ready' && (
        <div>
          <p>Connected! Available:</p>
          <ul>
            <li>Tools: {mcp.tools.length}</li>
            <li>Resources: {mcp.resources.length}</li>
            <li>Prompts: {mcp.prompts.length}</li>
          </ul>
          
          {/* Example buttons for testing resources and prompts */}
          <button onClick={handleResourceExample}>Test Resources</button>
          <button onClick={handlePromptExample}>Test Prompts</button>
        </div>
      )}

      {/* Your Chat UI */}
      <div>
        {messages.map((m) => (
          <div key={m.id}>
            <strong>{m.role}:</strong> {m.content}
            {/* Render tool calls/results if needed */}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something..."
          // Disable input if MCP is not ready and tools might be needed
          disabled={mcp.state !== 'ready' && mcp.state !== 'loading'}
        />
        <button type="submit" disabled={mcp.state !== 'ready'}>
          Send
        </button>
      </form>

      {/* Optional: Display logs for debugging */}
      {mcp.debug && (
        <pre style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8em', background: '#eee', padding: '5px' }}>
          {mcp.log.map((l, i) => (
            <div key={i}>
              [{l.level}] {new Date(l.timestamp).toLocaleTimeString()}: {l.message}
            </div>
          ))}
        </pre>
      )}
      {/* Button to clear stored auth data */}
      <button onClick={mcp.clearStorage} style={{ marginTop: '10px' }}>
        Clear Stored Auth
      </button>
    </div>
  )
}

export default MyChatComponent
```

## Hook Options (UseMcpOptions)

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | **Required**. The /sse URL of your MCP server |
| `clientName` | `string` | Name used for OAuth dynamic client registration (if applicable). Defaults to "MCP React Client" |
| `clientUri` | `string` | Client URI used for OAuth registration. Defaults to window.location.origin |
| `callbackUrl` | `string` | The absolute URL of your OAuth callback page. Must match the redirect URI registered with your OAuth server and the route where you call onMcpAuthorization. Defaults to /oauth/callback on the current origin |
| `storageKeyPrefix` | `string` | Prefix for keys used in localStorage (e.g., tokens, client info). Defaults to "mcp:auth". Useful to avoid conflicts if multiple MCP instances/apps run on the same origin |
| `clientConfig` | `object` | Information about the client application sent during the MCP handshake. Includes name (default: "mcp-react-client") and version (default: "0.1.0") |
| `customHeaders` | `Record<string, string>` | Custom headers that can be used to bypass auth |
| `debug` | `boolean` | Enable verbose logging to the console and the log state array. Defaults to false |
| `autoRetry` | `boolean \| number` | If true or a number (milliseconds), automatically tries to reconnect if the initial connection fails. Defaults to false. Uses a 5000ms delay if set to true |
| `autoReconnect` | `boolean \| number` | If true or a number (milliseconds), automatically tries to reconnect if an established connection is lost. Defaults to 3000ms |
| `popupFeatures` | `string` | Popup window features string (dimensions and behavior) for OAuth |

## Hook Return Value (UseMcpResult)

| Property | Type | Description |
|----------|------|-------------|
| `state` | `string` | Current connection state: 'discovering', 'authenticating', 'connecting', 'loading', 'ready', 'failed' |
| `tools` | `Tool[]` | Available tools from the MCP server |
| `resources` | `Resource[]` | Available resources from the MCP server |
| `prompts` | `Prompt[]` | Available prompts from the MCP server |
| `error` | `string \| undefined` | Error message if connection failed |
| `authUrl` | `string \| undefined` | Manual authentication URL if popup is blocked |
| `log` | `{ level: 'debug' \| 'info' \| 'warn' \| 'error'; message: string; timestamp: number }[]` | Array of log messages |
| `callTool` | `(name: string, args?: Record<string, unknown>) => Promise<any>` | Function to call a tool on the MCP server |
| `listResources` | `(cursor?: string) => Promise<any>` | Function to list resources from the MCP server |
| `readResource` | `(uri: string) => Promise<any>` | Function to read a specific resource from the MCP server |
| `listPrompts` | `(cursor?: string) => Promise<any>` | Function to list prompts from the MCP server |
| `getPrompt` | `(name: string) => Promise<any>` | Function to get a specific prompt from the MCP server |
| `retry` | `() => void` | Manually attempt to reconnect |
| `disconnect` | `() => void` | Disconnect from the MCP server |
| `authenticate` | `() => void` | Manually trigger authentication |
| `clearStorage` | `() => void` | Clear all stored authentication data |

## Connection States

- **discovering**: Checking server existence and capabilities (including auth requirements)
- **authenticating**: Authentication is required and the process (e.g., popup) has been initiated
- **connecting**: Establishing the SSE connection to the server
- **loading**: Connected; loading resources like the tool list
- **ready**: Connected and ready for tool calls, resource access, and prompt retrieval
- **failed**: Connection or authentication failed. Check the `error` property

## Features

- **Automatic Connection Management**: Handles connection lifecycle with automatic reconnection and retry logic
- **OAuth Authentication**: Supports OAuth flows with popup windows and fallback to manual authentication
- **Dual Transport Support**: Works with both HTTP and SSE (Server-Sent Events) transports
- **Resource Access**: Full access to MCP resources with listing and reading capabilities
- **Prompt Management**: Access to MCP prompts for template-based interactions
- **Tool Calling**: Execute tools on the MCP server with proper error handling
- **TypeScript Support**: Full type definitions for all APIs and return values
- **Debug Logging**: Comprehensive logging for troubleshooting connection issues
- **Error Recovery**: Built-in retry mechanisms and manual recovery options
