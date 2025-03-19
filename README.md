# mcp-chat

Open Source Generic MCP Client for testing & evaluating mcp servers and agents

## Quickstart

Make sure that you have `ANTHROPIC_API_KEY` exported in your environment or in a .env file in the root of the project. You can get an API key by signing up at the [Anthropic Console keys page](https://console.anthropic.com/settings/keys).

Simple use case that spawns an interactive chat prompt with the filesystem MCP server from CLI:

```shell
npx mcp-chat --server "npx -y @modelcontextprotocol/server-filesystem /Users/username/Desktop"
```

This will open up a chat prompt that you can use to interact with the servers and chat with an LLM.

## Config

You can also just specify your claude_desktop_config.json (Mac):

```shell
npx mcp-chat --config "~/Library/Application Support/Claude/claude_desktop_config.json"
```

Or (Windows):

```shell
npx mcp-chat --config "%APPDATA%\Claude\claude_desktop_config.json"
```

On linux, you can just make a claude_desktop_config.json anywhere and specify the path to it. Example json below:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/Users/username/Downloads"
      ]
    }
  }
}
```

## CLI Usage

Run prompts via CLI with the `-p` flag:

```shell
npx mcp-chat --server "npx mcp-server-kubernetes" -p "List the pods in the default namespace"
```

This runs the prompt with the kubenertes mcp-server & exits after the response is received on stdout.

Choose a model to chat with via CLI with the `-m` flag:

```shell
npx mcp-chat --server "npx mcp-server-kubernetes" -m "claude-3.5"
```

Uses the model `claude-3.5` to chat with. Note that currently only Anthropic models are supported.

Custom system prompt:

`--system` flag can be used to specify a system prompt:

```shell
npx mcp-chat --system "Explain the output to the user in pirate speak." --server "npx mcp-server-kubernetes" -p "List the pods in the default namespace"
```

## For developers of mcp-servers

You can pass in a local build of a python or node mcp-server to test it out with mcp-chat:

Node JS:

```shell
# Directly executing built script
npx mcp-chat --server "/path/to/mcp-server-kubernetes/dist/index.js"
# Using node / bun
npx mcp-chat --server "node /path/to/mcp-server-kubernetes/dist/index.js"
```

Python:

```shell
# Python: Using uv
npx mcp-chat --server "uv --directory /path/to/mcp-server-weather/ run weather.py"
# Using python / python3 - make sure to run in venv or install deps globally
npx mcp-chat --server "/path/to/mcp-server-weather/weather.py"
```

## Development

Install dependencies & run the CLI:

```shell
git clone https://github.com/Flux159/mcp-chat
bun install
bun run dev
```

To develop mcp-chat while connecting to an mcp-server, use "--" before the "--server" flag. Also note to escape the quotes because of the shell removing that otherwise (this isn't needed if you just build then run the dist/index.ts file, only if you run via `npm run dev` as an npm script):

```shell
npm run dev -- --server \"npx mcp-server-kubernetes\"
```

Testing:

```shell
bun run test
```

Building:

```shell
bun run build
```

Publishing:

```shell
bun run publish
```

Publishing Docker:

```shell
bun run dockerbuild
```

## Publishing new release

Go to the [releases](https://github.com/Flux159/mcp-chat/releases) page, click on "Draft New Release", click "Choose a tag" and create a new tag by typing out a new version number using "v{major}.{minor}.{patch}" semver format. Then, write a release title "Release v{major}.{minor}.{patch}" and description / changelog if necessary and click "Publish Release".

This will create a new tag which will trigger a new release build via the cd.yml workflow. Once successful, the new release will be published to npm. Note that there is no need to update the package.json version manually, as the workflow will automatically update the version number in the package.json file & push a commit to main.

## License

[MIT License](https://github.com/Flux159/mcp-chat/blob/main/LICENSE)
