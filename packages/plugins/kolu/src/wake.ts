export const wake = {

  subject: "wake on terminal activity",

  waiting: { one: "fleet event waiting", many: "fleet events waiting" },
}

export const fileFaultWords = {

    gone: [
      "The file this conversation's terminal wake was pointed at is no longer in the served directory — renamed, moved, or deleted.",
      "",
      "Written by olai's kolu watcher, not by a person.",
      "",
      "No terminals are being watched for this conversation any more. Nothing is claimed, nothing will be derived, and nothing is being held back — this is not a quiet fleet, it is a doorbell with no file behind it. Point the wake control at a file that exists and it starts again.",
    ].join("\n"),

    unwatchable: [
      "The file this conversation's terminal wake is pointed at is not an outline — it is served, and it holds no nodes, so nothing in it can claim a terminal.",
      "",
      "Written by olai's kolu watcher, not by a person.",
      "",
      "No terminals are being watched for this conversation. Nothing is claimed, nothing will be derived, and nothing is being held back — this is not a quiet fleet, it is a doorbell pointed at a file that can never carry a claim. Point the wake control at an outline and it starts.",
    ].join("\n"),
  }
