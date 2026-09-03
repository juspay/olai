/** The words this engine contributes to the no-agent face. */
import type { NotHere } from "@olai/plugin-api"

export const NAME = "Codex"

export const INSTALL: NotHere = {
  name: NAME,
  where: "https://developers.openai.com/codex",
  why: "not found — olai was started without the wrapper that carries the pinned adapter",
}
