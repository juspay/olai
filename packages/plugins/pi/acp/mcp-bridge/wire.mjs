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
        return {
          content: [{ type: "text", text: answerText(answer) }],
          ...(answer?.structuredContent === undefined ? {} : { details: answer.structuredContent }),
        };
      },
    });
  }
  return names;
};

export const answerText = (answer) => {
  const parts = Array.isArray(answer?.content) ? answer.content : [];
  const texts = parts
    .map((part) => (part?.type === "text" ? String(part.text ?? "") : `[${part?.type ?? "part"}]`))
    .join("\n");
  if (answer?.isError) return `the tool answered an error:\n${texts}`;
  return texts || "(the tool answered with no content)";
};
