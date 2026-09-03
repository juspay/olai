/**
 * ── the bridge's vocabulary, tested here and loaded there ────────────────
 *
 * What a handed MCP server becomes on a pi session. The pi-leg adapter
 * (pi-acp patched by this pin — see acp/patches/README.md) never sees these
 * names: it only hands the session's `mcpServers` to the process as
 * `PI_ACP_MCP_SERVERS`. The EXTENSION pi loads (`extension.mjs`, same
 * directory) is the whole reader, and these three pieces are the parts of it
 * that must never disagree with themselves:
 *
 *   - `toolName(server, tool)` — the name pi's LLM calls: `${server}_${tool}`
 *     frozen the way olai's panel already reads it (packages/surface's
 *     `AgentMark` row). pi tool names allow `[a-zA-Z0-9_-]` only, so every
 *     other character collapses to `_`, the servers we hand (`olai`, `kolu`)
 *     arriving unchanged.
 *   - `schemaToTypebox(schema)` — an MCP tool's `inputSchema` (JSON Schema)
 *     to the TypeBox TObject `pi.registerTool` demands. Only the six shapes
 *     olai's own servers produce are worth converting; anything else falls
 *     back to `Type.Any()` rather than guessed at: the model that calls a
 *     shape that needed guessing has the description to argue with it.
 *   - `serverToClientPlan(name, spec)` — one ACP `mcpServers` entry to the
 *     one client the extension spawns for it: stdio entries by
 *     command/args/env, `http`/`sse` entries by url. This is where the
 *     adapter's advertised { http: true, sse: true } becomes a fact.
 *
 * Patterned on acp/session-list-info/facts.js: the core is its own module
 * with its own `bun test` (`naming.test.js`), and `extension.mjs` imports
 * it. The regenerate script's job is only to splice this text and its kin
 * into the pin's `acp/patches/pi-mcp-servers.patch`.
 */

/** The characters would survive pi's tool-name validation. */
const toolSafe = (text) => String(text).replace(/[^a-zA-Z0-9_-]/g, "_");

export const toolName = (server, tool) => `${toolSafe(server)}_${toolSafe(tool)}`;

/**
 * The TypeBox the pi in question will validate against. Injected rather
 * than imported so this module stays verifiable under a bare `bun test`
 * with no pin in sight.
 */
export const schemaToTypebox = (Type, schema) => {
  const convert = (s) => {
    if (s == null || typeof s !== "object") return Type.Any();
    if (Array.isArray(s.enum) && s.enum.length > 0) return Type.Union(s.enum.map((v) => Type.Literal(v)));
    switch (typeof s.type === "string" ? s.type : "") {
      case "string":
        return Type.String({ description: s.description });
      case "number":
      case "integer":
        return Type.Number({ description: s.description });
      case "boolean":
        return Type.Boolean({ description: s.description });
      case "array":
        return Type.Array(convert(s.items), { description: s.description });
      case "object": {
        const props = {};
        const req = new Set(Array.isArray(s.required) ? s.required : []);
        for (const [key, value] of Object.entries(s.properties ?? {})) {
          const inner = req.has(key) ? convert(value) : Type.Optional(convert(value));
          props[key] = inner;
        }
        return Type.Object(props, { description: s.description });
      }
      default:
        // anyOf/oneOf/const-less shapes, format-decorated strings, and the
        // rest of JSON Schema's long tail: honest about the limit.
        return Type.Any({ description: s.description });
    }
  };
  const out = convert(schema);
  // registerTool demands an OBJECT at the top; an inputSchema's root always
  // is one (MCP requires { type: "object" }), but the adapter must not die
  // on a server that says otherwise.
  return out;
};

/**
 * ACP hands one of three shapes: stdio ({ name, command, args?, env? }),
 * http ({ name, type: "http", url, headers? }), or sse ({ name, type:
 * "sse", url, headers? }). The answer names which of the extension's three
 * transports to reach for, with everything the transport needs attached.
 */
export const serverToClientPlan = (name, spec) => {
  if (spec == null || typeof name !== "string") return null;
  if (typeof spec.command === "string" && spec.command.length > 0) {
    return {
      kind: "stdio",
      server: name,
      command: spec.command,
      args: Array.isArray(spec.args) ? spec.args : [],
      env: Array.isArray(spec.env)
        ? Object.fromEntries(spec.env.map((e) => [e.name, e.value]))
        : {},
    };
  }
  if (spec.type === "http" && typeof spec.url === "string") {
    return { kind: "http", server: name, url: spec.url, headers: spec.headers ?? {} };
  }
  if (spec.type === "sse" && typeof spec.url === "string") {
    return { kind: "sse", server: name, url: spec.url, headers: spec.headers ?? {} };
  }
  return null;
};

/**
 * WHAT THE ADAPTER HANDS: the raw `session/new` `mcpServers`, JSON. Empty
 * or broken input answers empty, and the extension that sees an empty list
 * simply registers nothing — a pi row without tool servers stays a pi row.
 */
export const parseServers = (json) => {
  if (typeof json !== "string" || json === "") return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
