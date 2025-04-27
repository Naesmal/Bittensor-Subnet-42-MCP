# MCP Blockchain Data Server

A Model Context Protocol (MCP) server providing access to Masa and Bittensor blockchain data through a unified interface, with LLM-optimized responses.

## Features

- **Modular API Support**: Enable/disable Masa and Bittensor APIs independently
- **Smart Rate Limiting**: Respects API rate limits to prevent service disruption
- **Multiple Transport Options**: Supports stdio and HTTP/SSE transports
- **LLM-Optimized Output**: Provides structured, human-readable summaries for each data point
- **Comprehensive Tools**: Provides a wide range of blockchain data access tools
- **Modular Design**: Clean separation of services and utilities
- **Detailed Logging**: Configurable logging levels for debugging and monitoring
- **Environment-based Configuration**: Easy setup through environment variables

## Tools

### Masa Tools

- **Twitter Search**: Search for recent tweets with automatic sentiment analysis
- **Web Scraper**: Extract content from web pages with summary and metrics
- **Search Term Extraction**: AI-powered extraction of relevant search terms with explanation
- **Tweet Analysis**: Analyze tweets with custom prompts and sentiment detection
- **Similarity Search**: Find semantically similar tweets with ranking

### Bittensor Tools

- **TAO Price**: Current and historical TAO token prices with trend analysis
- **Subnet Information**: Detailed subnet data with active validators, emissions, and historical changes
- **Validator Information**: Comprehensive validator statistics with earnings estimates and uptime stats
- **Top Validators**: Ranked list of top validators with performance metrics
- **Network Statistics**: Overall Bittensor network stats with market insights
- **Delegator Information**: Complete delegation data with reward estimates

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- API keys for Masa and Taostats services (optional but recommended)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/Naesmal/mcp-blockchain-server.git
cd mcp-blockchain-server
```

2. Install dependencies:

```bash
npm install
```

3. Copy the example environment file and modify it with your API keys:

```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. Build the server:

```bash
npm run build
```

## Configuration

The server is configured using environment variables, which can be set in a `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_MASA` | Enable Masa API tools | `true` |
| `ENABLE_TAOSTATS` | Enable Taostats API tools | `true` |
| `MASA_API_KEY` | Your Masa API key | (Required if Masa enabled) |
| `MASA_API_BASE_URL` | Masa API base URL | `https://data.dev.masalabs.ai` |
| `TAO_STAT_API_KEY` | Your Taostats API key | (Required if Taostats enabled) |
| `TAO_STAT_MINUTE_LIMIT` | Rate limit for Taostats API | `5` |
| `MCP_SERVER_NAME` | Name of the MCP server | `Blockchain Data Provider` |
| `MCP_SERVER_VERSION` | Server version | `1.0.0` |
| `MCP_SERVER_DESCRIPTION` | Server description | (Basic description) |
| `MCP_TRANSPORT_TYPE` | Transport type to use | `stdio` |
| `MCP_HTTP_PORT` | HTTP server port | `3030` |
| `MCP_HTTP_HOST` | HTTP server host | `localhost` |
| `LOG_LEVEL` | Logging level | `info` |

## Modular API Integration

This server is designed to be modular, allowing you to use Masa API, Taostats API, or both:

### Using Masa API Only

Set in your `.env` file:
```
ENABLE_MASA=true
ENABLE_TAOSTATS=false
MASA_API_KEY=your_masa_api_key_here
```

### Using Taostats API Only

Set in your `.env` file:
```
ENABLE_MASA=false
ENABLE_TAOSTATS=true
TAO_STAT_API_KEY=your_taostats_api_key_here
```

### Using Both APIs

Set in your `.env` file:
```
ENABLE_MASA=true
ENABLE_TAOSTATS=true
MASA_API_KEY=your_masa_api_key_here
TAO_STAT_API_KEY=your_taostats_api_key_here
```

You only need to provide API keys for the services you enable. Each set of tools will be registered only if the corresponding service is enabled.

## Usage

### Running the Server

Start the server with stdio transport (default):

```bash
npm start
```

For HTTP transport, set `MCP_TRANSPORT_TYPE=http` in your environment or `.env` file, then:

```bash
npm start
```

### Connecting with Claude Desktop

To connect with Claude Desktop, update your Claude Desktop configuration file:

On macOS:
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

On Windows:
```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

Add the following configuration:

```json
{
  "mcpServers": {
    "blockchain-data": {
      "command": "node",
      "args": [
        "/absolute/path/to/dist/index.js"
      ]
    }
  }
}
```

Restart Claude Desktop to apply the changes.

### Example Prompts

Here are some example prompts you can use with Claude Desktop after connecting:

- "What is the current price of TAO token and how has it changed recently?"
- "Show me detailed information about Bittensor subnet 1"
- "Who are the top 5 validators on Bittensor right now and what are their earnings?"
- "Get the latest tweets about 'AI and blockchain' and analyze the sentiment"
- "Show all the delegations for coldkey 5CA7zFakdjXtJRcz4gZ4MZaAwbEqDnW9WZeaqLRdTrejAs8w"
- "What's the overall Bittensor network statistics today?"
- "Can you find tweets semantically similar to 'decentralized AI networks'?"
- "Analyze these tweets and tell me the sentiment: [paste tweets here]"

## LLM-Optimized Features

This server provides several features specifically designed to enhance LLM interactions:

1. **Automatic Summarization**: Every API response includes a human-readable summary suitable for LLM consumption
2. **Data Contextualization**: Numbers and metrics are presented with context (e.g., percent changes, trends)
3. **Sentiment Analysis**: Automatic sentiment detection in Twitter content
4. **Structured Output**: Hierarchical, well-formatted data presentation optimized for LLM interpretation
5. **Keyword Extraction**: Identification of additional relevant search terms
6. **Rich Metrics**: Performance indicators, statistics and comparative data presented in digestible formats

These optimizations allow LLMs to better understand and effectively communicate the data to end users.

## Development

### Running in Development Mode

For development with automatic reloading:

```bash
npm run dev
```

### Linting

To run the linter:

```bash
npm run lint
```

### Testing

To run tests:

```bash
npm test
```

## Rate Limiting

The server implements token bucket rate limiting to respect API rate limits:

- Masa API: Default limit is 15 requests per minute
- Taostats API: Default limit is 5 requests per minute (configurable via `TAO_STAT_MINUTE_LIMIT`)

Rate limits are enforced per API service and requests will queue automatically when limits are reached.

## License

This project is licensed under the MIT License - see the LICENSE file for details.