# mcp-chat

Open Source Generic MCP Client for testing & evaluating mcp servers and agents

## Quickstart

Simple use case that spawns a chat prompt with two MCP servers from CLI:

```
npx mcp-chat --server "npx mcp-server-kubernetes" --server "npx -y @modelcontextprotocol/server-filesystem /Users/username/Desktop"
```

This will open up a chat prompt that you can use to interact with the servers and chat with an LLM.

## Config

You can also just specify your claude_desktop_config.json (Mac):

```
npx mcp-chat --config "~/Library/Application Support/Claude/claude_desktop_config.json"
```

Or (Windows):

```
npx mcp-chat --config "%APPDATA%\Claude\claude_desktop_config.json"
```

On linux, you can just make a claude_desktop_config.json anywhere and specify the path:

```
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

```
npx mcp-chat --server "npx mcp-server-kubernetes" -p "List the pods in the default namespace"
```

This runs the prompt with the kubenertes mcp-server & exits after the response is received on stdout.

Choose a model to chat with via CLI with the `-m` flag:

```
npx mcp-chat --server "npx mcp-server-kubernetes" -m "claude-3.5"
```

Uses the model `claude-3.5` to chat with.

## Agent Mode

You can also run mcp-chat in agent mode to chat with an LLM agent:

```
npx mcp-chat --server "npx mcp-server-kubernetes" --agent
```

Agent mode starts a prompt, but then will run in an agentic observe-reason-act loop similar to a [ReACT](https://arxiv.org/pdf/2210.03629) LLM agent.

## Evaluation mode

mcp-chat is a great way to setup evals (/"integration tests") for MCP servers. You can use the `--eval` flag to run a series of prompts and evaluate the responses.

```
npx mcp-chat --server "npx mcp-server-kubernetes" --eval "evals/kubernetes.json"
```

The output is generated in the out/evals output directory and can be viewed in a CLI or browser.

Set it up to run in a CI/CD pipeline to evaluate your mcp servers against known good prompts & / validate the outputs.

## Development

Install dependencies & run the CLI:

```
git clone https://github.com/Flux159/mcp-chat
bun install
bun run dev
```

To develop mcp-chat while connecting to an mcp-server, use "--" before the "--server" flag. Also note to escape the quotes because of the shell removing that otherwise (this isn't needed if you just build then run the dist/index.ts file, only if you run via `npm run dev` as an npm script):

```
npm run dev -- --server \"npx mcp-server-kubernetes\"
```

Testing:

```
bun run test
```

Building:

```
bun run build
```

Publishing:

```
bun run publish
```

Publishing Docker:

```
bun run dockerbuild
```

## Publishing new release

Go to the [releases](https://github.com/Flux159/mcp-chat/releases) page, click on "Draft New Release", click "Choose a tag" and create a new tag by typing out a new version number using "v{major}.{minor}.{patch}" semver format. Then, write a release title "Release v{major}.{minor}.{patch}" and description / changelog if necessary and click "Publish Release".

This will create a new tag which will trigger a new release build via the cd.yml workflow. Once successful, the new release will be published to npm. Note that there is no need to update the package.json version manually, as the workflow will automatically update the version number in the package.json file & push a commit to main.

## License

[MIT License](https://github.com/Flux159/mcp-chat/blob/main/LICENSE)
