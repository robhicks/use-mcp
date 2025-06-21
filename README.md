<div class="oranda-hide">

# 🦑 use-mcp 🦑

</div>

[![GitHub last commit](https://img.shields.io/github/last-commit/modelcontextprotocol/use-mcp?logo=github&style=flat&label=​)](https://github.com/modelcontextprotocol/use-mcp)&nbsp; [![npm](https://img.shields.io/npm/v/use-mcp?label=​&logo=npm)](https://www.npmjs.com/package/use-mcp) ![GitHub License](https://img.shields.io/github/license/modelcontextprotocol/use-mcp)

A lightweight React hook for connecting to [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) servers. Simplifies authentication and tool calling for AI systems implementing the MCP standard.

Try it out: [MCP Inspector](https://inspector.use-mcp.dev) | [Cloudflare Workers AI Playground](https://playground.ai.cloudflare.com/)

## Installation

```bash
npm install use-mcp
# or
pnpm add use-mcp
# or
yarn add use-mcp
```

## Features

- 🔄 Automatic connection management with reconnection and retries
- 🔐 OAuth authentication flow handling with popup and fallback support
- 📦 Simple React hook interface for MCP integration
- 🧰 TypeScript types for editor assistance and type checking
- 📝 Comprehensive logging for debugging
- 🌐 Works with both HTTP and SSE (Server-Sent Events) transports
- 📚 Full access to MCP resources and prompts
- 🛠️ Tool calling with automatic retry and error handling

## Quick Start

```tsx
import { useMcp } from 'use-mcp/react'

function MyAIComponent() {
  const {
    state,          // Connection state: 'discovering' | 'authenticating' | 'connecting' | 'loading' | 'ready' | 'failed'
    tools,          // Available tools from MCP server
    resources,      // Available resources from MCP server
    prompts,        // Available prompts from MCP server
    error,          // Error message if connection failed
    callTool,       // Function to call tools on the MCP server
    listResources,  // Function to list resources from MCP server
    readResource,   // Function to read a specific resource from MCP server
    listPrompts,    // Function to list prompts from MCP server
    getPrompt,      // Function to get a specific prompt from MCP server
    retry,          // Retry connection manually
    authenticate,   // Manually trigger authentication
    clearStorage,   // Clear stored tokens and credentials
  } = useMcp({
    url: 'https://your-mcp-server.com',
    clientName: 'My App',
    autoReconnect: true,
  })

  // Handle different states
  if (state === 'failed') {
    return (
      <div>
        <p>Connection failed: {error}</p>
        <button onClick={retry}>Retry</button>
        <button onClick={authenticate}>Authenticate Manually</button>
      </div>
    )
  }

  if (state !== 'ready') {
    return <div>Connecting to AI service...</div>
  }

  // Use available tools
  const handleSearch = async () => {
    try {
      const result = await callTool('search', { query: 'example search' })
      console.log('Search results:', result)
    } catch (err) {
      console.error('Tool call failed:', err)
    }
  }

  // Use available resources
  const handleResourceExample = async () => {
    try {
      const resourcesList = await listResources()
      console.log('Available resources:', resourcesList.resources)
      
      if (resourcesList.resources.length > 0) {
        const resource = await readResource(resourcesList.resources[0].uri)
        console.log('Resource contents:', resource)
      }
    } catch (err) {
      console.error('Resource access failed:', err)
    }
  }

  // Use available prompts
  const handlePromptExample = async () => {
    try {
      const promptsList = await listPrompts()
      console.log('Available prompts:', promptsList.prompts)
      
      if (promptsList.prompts.length > 0) {
        const prompt = await getPrompt(promptsList.prompts[0].name)
        console.log('Prompt details:', prompt)
      }
    } catch (err) {
      console.error('Prompt access failed:', err)
    }
  }

  return (
    <div>
      <h2>Available Tools: {tools.length}</h2>
      <ul>
        {tools.map(tool => (
          <li key={tool.name}>{tool.name}</li>
        ))}
      </ul>
      
      <h2>Available Resources: {resources.length}</h2>
      <ul>
        {resources.map(resource => (
          <li key={resource.uri}>{resource.uri}</li>
        ))}
      </ul>
      
      <h2>Available Prompts: {prompts.length}</h2>
      <ul>
        {prompts.map(prompt => (
          <li key={prompt.name}>{prompt.name}</li>
        ))}
      </ul>
      
      <button onClick={handleSearch}>Search</button>
      <button onClick={handleResourceExample}>Access Resources</button>
      <button onClick={handlePromptExample}>Access Prompts</button>
    </div>
  )
}
```

## Setting Up OAuth Callback

To handle the OAuth authentication flow, you need to set up a callback endpoint in your app.

### With React Router

```tsx
// App.tsx with React Router
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { onMcpAuthorization } from 'use-mcp'

function OAuthCallback() {
  useEffect(() => {
    onMcpAuthorization()
  }, [])

  return (
    <div>
      <h1>Authenticating...</h1>
      <p>This window should close automatically.</p>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/" element={<YourMainComponent />} />
      </Routes>
    </Router>
  )
}
```

### With Next.js Pages Router

```tsx
// pages/oauth/callback.tsx
import { useEffect } from 'react'
import { onMcpAuthorization } from 'use-mcp'

export default function OAuthCallbackPage() {
  useEffect(() => {
    onMcpAuthorization()
  }, [])

  return (
    <div>
      <h1>Authenticating...</h1>
      <p>This window should close automatically.</p>
    </div>
  )
}
```

## API Reference

### `useMcp` Hook

```ts
function useMcp(options: UseMcpOptions): UseMcpResult
```

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | **Required**. URL of your MCP server |
| `clientName` | `string` | Name of your client for OAuth registration |
| `clientUri` | `string` | URI of your client for OAuth registration |
| `callbackUrl` | `string` | Custom callback URL for OAuth redirect (defaults to `/oauth/callback` on the current origin) |
| `storageKeyPrefix` | `string` | Storage key prefix for OAuth data in localStorage (defaults to "mcp:auth") |
| `clientConfig` | `object` | Custom configuration for the MCP client identity |
| `customHeaders` | `Record<string, string>` | Custom headers that can be used to bypass auth |
| `debug` | `boolean` | Whether to enable verbose debug logging |
| `autoRetry` | `boolean \| number` | Auto retry connection if initial connection fails, with delay in ms |
| `autoReconnect` | `boolean \| number` | Auto reconnect if an established connection is lost, with delay in ms (default: 3000) |
| `popupFeatures` | `string` | Popup window features string (dimensions and behavior) for OAuth |

#### Return Value

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

## License

MIT