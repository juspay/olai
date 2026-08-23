<p align="center">
  <img src="website/leaf.jpg" width="220" alt="A palm leaf drawn in ink on sea-glass paper, coral at the tips — the olai mark.">
</p>

# olai

An outliner whose file format is a git-reviewable one, and whose editor is a browser and an agent rather than a text buffer.

**[olai.kolu.dev](https://olai.kolu.dev)** — what it is, how to run it, and why.

Outlines are `.olai` files. A vault written before the rename is renamed once, by hand — olai reads the one extension and migrates nothing for you: [the one-liner](docs/format.md#the-outline-format).

A coding agent in a terminal reaches the same tools over HTTP, against a running server. Production (the home-manager user service) binds `127.0.0.1:7714`; `just run` in a worktree asks the OS for a port and writes it to `.olai-dev/url`, so it cannot squat that address:

```json
{
  "mcpServers": {
    "olai": {
      "type": "http",
      "url": "http://127.0.0.1:7714/mcp"
    }
  }
}
```

You reach the same tools from a shell, through that same door — every verb an agent has, under the same name:

```sh
olai surface --url http://127.0.0.1:7714 capture "look into the new cabinets"
olai surface --url http://127.0.0.1:7714 get outlines _olai/Inbox.olai
```

`--url` is required on every call, because a vault is not a thing to infer. `olai surface --help` is the documentation for it — the verbs grouped by what they do, with an example each.

Docs: [docs/index.md](docs/index.md) · Running: [docs/running.md](docs/running.md) · Developing: [HACKING.md](HACKING.md)
