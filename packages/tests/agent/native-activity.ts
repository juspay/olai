/** codex-acp 1.10's native session/AIR messages, with no Claude metadata. */
export const nativeActivity = async (
  argument: string,
  root: string,
  notify: (method: string, params: unknown) => void,
  request: (method: string, params: unknown) => Promise<unknown>,
  released: () => Promise<void>,
  cancelled: () => boolean = () => false,
): Promise<void> => {
  const update = (sessionId: string, update: unknown) => notify("session/update", { sessionId, update })
  const spawn = (parent: string, child: string, task: string) => update(parent, {
    sessionUpdate: "subagent_spawned", subagentSessionId: child, name: "Explorer", task, capabilities: {},
  })
  const call = (session: string, title: string) => update(session, {
    sessionUpdate: "tool_call", toolCallId: "shared-call", title, status: "completed",
    content: [{ type: "terminal", terminalId: "shared-terminal" }],
    _meta: { terminal_info: { terminal_id: "shared-terminal" },
      terminal_output: { terminal_id: "shared-terminal", data: `${title} output` },
      terminal_exit: { terminal_id: "shared-terminal", exit_code: 0, signal: null } },
  })
  if (argument.startsWith("watch")) {
    const state = argument.split(" ")[1] ?? "failed"
    call(root, "watch files")
    update(root, { sessionUpdate: "async_task_spawned", asyncTaskId: "watch-task", name: "watch files",
      taskType: "shell", showInTranscript: false, canStop: true, toolCallId: "shared-call" })
    // A command result may arrive after the task was announced.
    update(root, { sessionUpdate: "tool_call_update", toolCallId: "shared-call", status: "completed" })
    void released().then(() => {
      update(root, { sessionUpdate: "async_task_state_update", asyncTaskId: "watch-task", state,
        toolCallId: "shared-call", summary: "watch ended" })
      update(root, { sessionUpdate: "async_task_state_update", asyncTaskId: "watch-task", state,
        toolCallId: "shared-call", summary: "watch ended" })
    })
    return
  }
  const child = `${root}:child`
  spawn(root, child, "explore the outline")
  call(root, "root command")
  call(child, "child command")
  update(child, { sessionUpdate: "tool_call", toolCallId: "second", title: "second child command", status: "completed" })
  update(child, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Private child report" } })
  update(child, { sessionUpdate: "session_info_update", title: "Wrong child title" })
  if (argument === "nested") {
    spawn(child, `${child}:nested`, "inspect nested work")
    call(`${child}:nested`, "nested command")
    update(child, { sessionUpdate: "subagent_state_update", subagentSessionId: `${child}:nested`, state: "completed" })
  }
  if (argument === "asks" || argument === "elicits") {
    if (argument === "asks") await request("session/request_permission", {
      sessionId: child, toolCall: { toolCallId: "shared-call", title: "run a child command" },
      options: [{ optionId: "allow", name: "Allow Once", kind: "allow_once" }, { optionId: "deny", name: "Deny", kind: "reject_once" }],
    })
    else await request("elicitation/create", {
      mode: "form", sessionId: child, message: "Which cabinets should I order?",
      requestedSchema: { type: "object", properties: { question_0: { type: "string", title: "Cabinets", enum: ["Upper cabinets", "Lower cabinets"] } }, required: ["question_0"] },
    })
  }
  if (argument === "slow") await released()
  update(root, { sessionUpdate: "subagent_state_update", subagentSessionId: child, state: cancelled() ? "cancelled" : "completed" })
}
