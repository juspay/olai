const toolSafe = (text) => String(text).replace(/[^a-zA-Z0-9_-]/g, "_");

export const toolName = (server, tool) => `${toolSafe(server)}_${toolSafe(tool)}`;

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
        return Type.Any({ description: s.description });
    }
  };
  const out = convert(schema);
  return out;
};

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

export const parseServers = (json) => {
  if (typeof json !== "string" || json === "") return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
