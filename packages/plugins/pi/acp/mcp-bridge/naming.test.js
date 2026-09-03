/**
 * The bridge's vocabulary under test — `bun test acp/mcp-bridge` runs this
 * with no pin in sight, exactly the isolation naming.js was factored for.
 */
import { describe, expect, test } from "bun:test";

import { parseServers, schemaToTypebox, serverToClientPlan, toolName } from "./naming.js";

// A TypeBox look-alike carrying just enough of the real API to assert the
// CONVERTER's choices: every Type.X is a constructor that remembers its
// options. The pi-side import of the real "typebox" is the extension's.
const Type = {
  Any: (o) => ({ $kind: "any", ...o }),
  String: (o) => ({ $kind: "string", ...o }),
  Number: (o) => ({ $kind: "number", ...o }),
  Boolean: (o) => ({ $kind: "boolean", ...o }),
  Array: (items, o) => ({ $kind: "array", items, ...o }),
  Object: (props, o) => ({ $kind: "object", props, ...o }),
  Optional: (t) => ({ ...t, $optional: true }),
  Literal: (v) => ({ $kind: "literal", value: v }),
  Union: (ts) => ({ $kind: "union", ts }),
};

describe("toolName", () => {
  test("olai and kolu arrive unchanged", () => {
    expect(toolName("olai", "read_node")).toBe("olai_read_node");
    expect(toolName("kolu", "list_terminals")).toBe("kolu_list_terminals");
  });

  test("pi's tool-name alphabet collapses the rest", () => {
    expect(toolName("my server", "do.thing")).toBe("my_server_do_thing");
  });
});

describe("schemaToTypebox", () => {
  test("an olai-shaped object keeps its requireds and its optionals", () => {
    const out = schemaToTypebox(Type, {
      type: "object",
      required: ["node"],
      properties: {
        node: { type: "string", description: "the node's name" },
        under: { type: "string" },
      },
    });
    expect(out.$kind).toBe("object");
    expect(out.props.node.$kind).toBe("string");
    expect(out.props.node.$optional).toBeUndefined();
    expect(out.props.under.$optional).toBe(true);
  });

  test("numbers, booleans, arrays, enums", () => {
    const out = schemaToTypebox(Type, {
      type: "object",
      properties: {
        n: { type: "integer" },
        b: { type: "boolean" },
        xs: { type: "array", items: { type: "string" } },
        pick: { type: "string", enum: ["a", "b"] },
      },
    });
    expect(out.props.n.$kind).toBe("number");
    expect(out.props.b.$kind).toBe("boolean");
    expect(out.props.xs.$kind).toBe("array");
    expect(out.props.xs.items.$kind).toBe("string");
    expect(out.props.pick.$kind).toBe("union");
    expect(out.props.pick.ts).toEqual([Type.Literal("a"), Type.Literal("b")]);
  });

  test("shapes no one should guess on fall back to Any, not an empty guess", () => {
    expect(schemaToTypebox(Type, { anyOf: [{ type: "string" }] }).$kind).toBe("any");
    expect(schemaToTypebox(Type, null).$kind).toBe("any");
    expect(schemaToTypebox(Type, { type: "string", format: "date" }).$kind).toBe("string");
  });
});

describe("serverToClientPlan", () => {
  test("stdio: command/args, env pairs to record", () => {
    expect(
      serverToClientPlan("kolu", {
        name: "kolu",
        command: "npx",
        args: ["-y", "@kolu/client"],
        env: [{ name: "KOLU_SESSION", value: "s1" }],
      }),
    ).toEqual({ kind: "stdio", server: "kolu", command: "npx", args: ["-y", "@kolu/client"], env: { KOLU_SESSION: "s1" } });
  });

  test("http and sse by url", () => {
    expect(serverToClientPlan("olai", { name: "olai", type: "http", url: "http://127.0.0.1:1/mcp" })).toEqual({
      kind: "http",
      server: "olai",
      url: "http://127.0.0.1:1/mcp",
      headers: {},
    });
    expect(serverToClientPlan("sse-one", { name: "sse-one", type: "sse", url: "http://127.0.0.1:2/s" }).kind).toBe("sse");
  });

  test("the shape no one handed answers null", () => {
    expect(serverToClientPlan("x", {})).toBeNull();
    expect(serverToClientPlan("x", { type: "http" })).toBeNull();
  });
});

describe("parseServers", () => {
  test("what the adapter hands", () => {
    expect(parseServers('[{"name":"olai","type":"http","url":"http://x/mcp"}]').length).toBe(1);
    expect(parseServers("")).toEqual([]);
    expect(parseServers("{broken")).toEqual([]);
    expect(parseServers('{"not":"an array"}')).toEqual([]);
  });
});
