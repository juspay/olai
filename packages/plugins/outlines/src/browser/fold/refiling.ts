import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import { createEffect } from "solid-js"

import type { HomesAnswer, HomesRequest } from "@olai/format"
import type { OpFailure } from "@olai/format"
import { askingOf, folded, homesOf, type Memory, refiled } from "./memory.ts"

export const SETTLE_MS = 750

export interface Asking {
  readonly ask: (
    request: HomesRequest,
  ) => Promise<Result.Result<HomesAnswer, OpFailure>>
  readonly reachable: () => boolean
}

export const createRefiling = (wire: Asking): void => {
  let newestAsked = 0

  const put = (memory: Memory): void => {
    const asked = ++newestAsked
    void wire.ask(askingOf(memory)).then((outcome) => {
      if (asked !== newestAsked) return
      if (Result.isFailure(outcome)) {
        console.warn(
          "olai: could not ask where the folded nodes now live, so this browser's fold memory is not being tidied —",
          outcome.failure.message,
        )
        return
      }
      refiled(homesOf(memory, outcome.success))
    })
  }

  const settle = debounce(put, SETTLE_MS)

  createEffect(() => {
    const memory = folded()
    if (memory.printed === null || !wire.reachable()) {
      settle.clear()
      return
    }
    settle(memory)
  })
}
