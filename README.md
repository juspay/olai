# olai

An outliner whose file format is a git-reviewable one, and whose editor is a browser and an agent rather than a text buffer.

**[olai.kolu.dev](https://olai.kolu.dev)** — what it is, how to run it, and why.

Outlines are `.olai` files. A vault written before the rename is renamed once, by hand — olai reads the one extension and migrates nothing for you: [the one-liner](docs/format.md#the-outline-format).

A coding agent in a terminal reaches the same tools over HTTP, against a running server — `just run` binds this repo on `127.0.0.1:7714`:

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

Docs: [docs/index.md](docs/index.md) · Running: [docs/running.md](docs/running.md) · Developing: [HACKING.md](HACKING.md)
