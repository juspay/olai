/**
 * The bridge's pi-facing wiring, kept SDK-less on purpose: the pin's tests
 * (roundtrip.test.js) import THIS file, never the extension shell, because
 * extension.mjs's static imports exist for the bundler's eye (they name
 * paths that only mean something inside the pin's node_modules layout).
 *
 * `registerServerTools` is the line the round-trip test crosses: given a
 * CONNECTED SDK client and the plan it answered, list its tools and
 * registerTool each onto pi's api under the panel's name (`${server}_${
 * tool}` — the same name olai's surface uses). Returns the names it minted.
 *
 * `Type` is the typebox the shell (real pin) or the test (its npm twin)
 * passes in — kept a parameter so this file's import graph stays proof
 * against whichever engine pi's jiti hands it to.
 */

import { schemaToTypebox, toolName } from "./naming.js";

export const registerServerTools = async (pi, Type, client, plan) => {
  const { tools } = await client.listTools();
  const names = [];
  for (const tool of tools) {
    const name = toolName(plan.server, tool.name);
    names.push(name);
    pi.registerTool({
      name,
      label: `${plan.server}: ${tool.name}`,
      description: tool.description ?? `${tool.name} from ${plan.server}`,
      parameters: schemaToTypebox(Type, tool.inputSchema),
      async execute(_id, args) {
        const answer = await client.callTool({ name: tool.name, arguments: args ?? {} });
        return { content: [{ type: "text", text: answerText(answer) }] };
      },
    });
  }
  return names;
};

/** The long text of an MCP content array: text parts joined, the rest named. */
export const answerText = (answer) => {
  const parts = Array.isArray(answer?.content) ? answer.content : [];
  const texts = parts
    .map((part) => (part?.type === "text" ? String(part.text ?? "") : `[${part?.type ?? "part"}]`))
    .join("\n");
  if (answer?.isError) return `the tool answered an error:\n${texts}`;
  return texts || "(the tool answered with no content)";
};
