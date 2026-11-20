import type { Listed, SessionInfo } from "olai-plugin-chat/wire"
import { Effect, Semaphore } from "effect"

import { type AgentGone, newestFirst } from "@kolu/acp-client"
import type { Installed } from "./agents/roster.ts"
import type { Stored } from "@kolu/acp-client"

export interface Where {
  readonly roster: () => ReadonlyArray<Installed>
  readonly running: (row: Installed) => Effect.Effect<ReadonlyArray<Stored>, AgentGone> | null
  readonly aside: (row: Installed) => Effect.Effect<Asked, AgentGone>
  readonly now: () => number
}

export interface Asked {
  readonly stored: ReadonlyArray<Stored>
  readonly keep: boolean
}

export const KEEP_FOR_MS = 15_000

interface Kept {
  readonly at: number
  readonly sessions: ReadonlyArray<SessionInfo>
}

export interface Listings {
  readonly all: Effect.Effect<Listed>
  readonly forget: (agent: string) => void
}

export const make = (where: Where): Effect.Effect<Listings> =>
  Effect.gen(function*() {
    const oneAtATime = yield* Semaphore.make(1)
    const answers = new Map<string, Kept>()

    const keep = (agent: string, sessions: ReadonlyArray<SessionInfo>): void => {
      answers.set(agent, { at: where.now(), sessions })
    }

    const fresh = (agent: string): ReadonlyArray<SessionInfo> | null => {
      const had = answers.get(agent)
      if (had === undefined) return null
      return where.now() - had.at < KEEP_FOR_MS ? had.sessions : null
    }

    const found = (row: Installed, stored: ReadonlyArray<Stored>): Listed => ({
      sessions: stored.map((entry): SessionInfo => ({
        id: entry.id,
        agent: row.id,
        title: entry.title,
        updatedAt: entry.updatedAt,
        messageCount: entry.messageCount,
        supersededBy: entry.supersededBy === null ? null : { agent: row.id, session: entry.supersededBy },
      })),
      unreachable: [],
    })

    const couldNotAsk = (row: Installed, gone: AgentGone): Listed => ({
      sessions: [],
      unreachable: [{ agent: row.id, why: gone.why }],
    })

    const kept = (sessions: ReadonlyArray<SessionInfo>): Listed => ({
      sessions,
      unreachable: [],
    })

    const storedBy = (row: Installed): Effect.Effect<Listed> =>
      Effect.suspend(() => {
        const live = where.running(row)
        if (live !== null) {
          return Effect.match(live, {
            onSuccess: (stored) => found(row, stored),
            onFailure: (gone) => couldNotAsk(row, gone),
          })
        }
        const had = fresh(row.id)
        if (had !== null) return Effect.succeed(kept(had))
        return oneAtATime.withPermit(Effect.gen(function*() {
          const now = fresh(row.id)
          if (now !== null) return kept(now)
          const asked = yield* Effect.result(where.aside(row))
          if (asked._tag === "Failure") return couldNotAsk(row, asked.failure)
          const answer = found(row, asked.success.stored)
          if (asked.success.keep) keep(row.id, answer.sessions)
          return answer
        }))
      })

    return {
      all: Effect.suspend(() =>
        Effect.map(
          Effect.forEach(where.roster(), storedBy, { concurrency: "unbounded" }),
          asOneList,
        )
      ),
      forget: (agent) => {
        answers.delete(agent)
      },
    }
  })

export const asOneList = (answers: ReadonlyArray<Listed>): Listed => ({
  sessions: answers.flatMap((answer) => answer.sessions).sort(newestFirst),
  unreachable: answers.flatMap((answer) => answer.unreachable),
})
