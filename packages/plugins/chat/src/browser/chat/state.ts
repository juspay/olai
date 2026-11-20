import type { Json } from "../../json.ts"
import type { Refusal } from "../../slots.ts"
import { Effect } from "effect"

import { type Attached, CHAT_OFF, type ChatEntry, type ChatState, type Conversing, type PanelAddress, agentIn, transcriptRows, sayingRows, TRANSCRIPT_PAGE } from "olai-plugin-chat/wire"
import { type OpFailure, UsageFailure } from "@olai/format"
import { type AskAnswer } from "@kolu/acp/wire"
import { type Accessor, createEffect, createMemo, createSelector, createSignal, on, onCleanup } from "solid-js"
import { chatWire } from "../wire.ts"

import { type Call, run, runAsync } from "@olai/web/client/run.ts"
import { attaching, type UploadProgress } from "./attach.ts"
import { orderOf, useRows } from "./order.ts"
import { createTail, grownText } from "./growing.ts"
import { createConversationUI, type ConversationUI } from "./ui.tsx"

export type Uploaded =
  | { readonly _tag: "stored"; readonly stored: Attached }
  | { readonly _tag: "refused"; readonly failure: OpFailure }
  | { readonly _tag: "gone" }

export interface Chat {
  readonly ui: ConversationUI
  readonly state: Accessor<ChatState>
  readonly rows: Accessor<ReadonlyArray<string>>
  readonly lanes: Accessor<ReadonlyMap<string, ReadonlyArray<string>>>
  readonly entry: (key: string) => Accessor<ChatEntry | undefined>
  readonly earlier: Accessor<number>
  readonly earlierLoading: Accessor<boolean>
  readonly loadEarlier: () => void
  readonly refused: Accessor<OpFailure | null>
  readonly pendingSends: Accessor<number>
  readonly refuse: (reasons: ReadonlyArray<string>) => void
  readonly send: (
    text: string,
    attachments: ReadonlyArray<string>,
    context: ReadonlyArray<string>,
    steer?: boolean,
  ) => Promise<boolean>
  readonly attach: (file: File, progress?: UploadProgress) => Promise<Uploaded>
  readonly resend: (id: string) => void
  readonly setSetting: (agent: string, session: string, config: string, value: string | boolean, done: () => void) => void
  readonly setModel: (agent: string, session: string, value: string, done: () => void) => void
  readonly cancel: () => void
  readonly loadSession: (agent: string, id: string) => void
  readonly reopen: () => void
  readonly answer: (
    id: string,
    answers: ReadonlyArray<AskAnswer>,
    done?: () => void,
  ) => void
  readonly decline: (id: string, done?: () => void) => void
  readonly signIn: (method: string | null) => void
  readonly signInInput: (text: string) => void
  readonly signInCancel: () => void
  readonly takeBack: () => string | null
  readonly scope: (
    agent: string,
    session: string,
    plugin: string,
    pick: Json,
  ) => Effect.Effect<void, Refusal>
}

export const createChatState = (
  conv: PanelAddress,
  matchingSession?: Conversing | null,
): Accessor<ChatState> => {
  const cell = chatWire().streams.state.use(() => conv)
  return createMemo<ChatState>(() => {
    const next = cell() ?? CHAT_OFF
    if (matchingSession !== undefined && next.session !== null
      && (matchingSession === null || next.session.id !== matchingSession.session
        || agentIn(next)?.id !== matchingSession.agent)) return CHAT_OFF
    return next
  })
}

const restartedUnderneath = (
  held: ReadonlyMap<string, ChatEntry>,
  entries: ReadonlyArray<readonly [string, ChatEntry]>,
): boolean => {
  if (entries.length === 0) return false
  let oldestSnapshot = Infinity
  for (const [key, row] of entries) {
    if (held.has(key)) return false
    if (row.seq < oldestSnapshot) oldestSnapshot = row.seq
  }
  let oldestHeld = Infinity
  for (const row of held.values()) if (row.seq < oldestHeld) oldestHeld = row.seq
  return oldestSnapshot <= oldestHeld
}

export const createChat = (conv: PanelAddress, options: { readonly ui?: ConversationUI; readonly expected?: Conversing | null; readonly visit?: (to: Conversing) => void } = {}): Chat => {  const ui = options.ui ?? createConversationUI()
  const { closePreview } = ui.previewing
  const [refused, setRefused] = ui.refused
  const served = createChatState(conv, options.expected)
  const transcript = chatWire().streams.transcript.useCollection(conv, transcriptRows)
  const said = createTail(chatWire().streams.saying.useCollection(conv, sayingRows).fold)

  const grown = createMemo((): ChatEntry | undefined => {
    const key = said.of()
    const held = said.tail()
    const row = key === null ? undefined : transcript.byKey(key)?.()
    if (row === undefined || held === null) return row
    const text = grownText(row, held)
    return text === row.text ? row : { ...row, text }
  })

  const growing = createSelector(said.of)

  const window = useRows(transcript.fold)

  let held = new Map<string, ChatEntry>()
  let heldSession: string | null | undefined
  const [revision, setRevision] = createSignal(0)
  transcript.fold<void>({
    init: (entries) => {
      const session = served().session?.id ?? null
      const restarted = held.size === 0
        || session !== heldSession
        || restartedUnderneath(held, entries)
      heldSession = session
      if (restarted) {
        held = new Map(entries.map(([key, row]) => [key, row]))
        setRevision((count) => count + 1)
      } else {
        for (const [key, row] of entries) held.set(key, row)
      }
    },
    step: (_held, delta) => {
      for (const key of delta.removes) held.delete(key)
      for (const [key, row] of delta.upserts) held.set(key, row)
    },
  })

  const [earlierLoading, setEarlierLoading] = createSignal(false)

  const history = createMemo(() => {
    revision()
    const inWindow = new Set(window.keys())
    return new Map([...held].filter(([key]) => !inWindow.has(key)))
  })

  const older = createMemo(() => orderOf([...history().values()]))

  const entry = (key: string): Accessor<ChatEntry | undefined> => () => {
    const live = transcript.byKey(key)
    if (live !== undefined) return growing(key) ? grown() : live()
    return history().get(key)
  }

  const rows = createMemo(() => [...older().keys, ...window.keys()])

  const lanes = createMemo(() => {
    const pulled = older().lanes
    const live = window.lanes()
    if (pulled.size === 0) return live
    if (live.size === 0) return pulled
    return new Map([...pulled, ...live])
  })

  const oldest = (): number | undefined => {
    let min: number | undefined
    for (const row of history().values()) if (min === undefined || row.seq < min) min = row.seq
    const first = window.keys()[0]
    if (first !== undefined) {
      const seq = transcript.byKey(first)?.()?.seq
      if (seq !== undefined && (min === undefined || seq < min)) min = seq
    }
    return min
  }

  const earlier = createMemo(() => oldest() ?? 0)

  const loadEarlier = (): void => {
    if (earlierLoading() || earlier() === 0) return
    const before = oldest()
    if (before === undefined || before <= 0) return
    setEarlierLoading(true)
    run(
      chatWire().procedures.conversation.earlier({ conv, before, limit: TRANSCRIPT_PAGE }),
      (failure) => {
        setEarlierLoading(false)
        setRefused(failure)
      },
      (page) => {
        setEarlierLoading(false)
        if (page.length === 0) return
        for (const row of page) held.set(row.id, row)
        setRevision((count) => count + 1)
      },
    )
  }

  let handedBack: string | null = null
  const takeBack = (): string | null => {
    if (served().signIn === null) return null
    const keys = rows()
    for (let at = keys.length - 1; at >= 0; at--) {
      const row = entry(keys[at]!)()
      if (row === undefined || row.kind !== "user") continue
      if (row.signIn === undefined || row.delivery !== "refused" || handedBack === row.id) return null
      handedBack = row.id
      return row.text
    }
    return null
  }

  const [starting, setStarting] = ui.starting
  const [pendingSends, setPendingSends] = ui.pendingSends

  const [awaiting, setAwaiting] = createSignal<ReadonlySet<(scope: string | null) => void>>(new Set())
  let disposed = false
  onCleanup(() => {
    disposed = true
    for (const settle of awaiting()) settle(null)
    setAwaiting(new Set<(scope: string | null) => void>())
  })
  createEffect(() => {
    const current = served()
    if (current.unopened === null && (("session" in conv ? current.session?.id !== conv.session : current.session === null) || current.uploadScope === null)) return
    const scope = current.unopened === null ? current.uploadScope : null
    for (const settle of awaiting()) settle(scope)
    if (awaiting().size > 0) setAwaiting(new Set<(scope: string | null) => void>())
  })
  const sendingScope = (): Promise<string | null> => {
    const current = served()
    if (disposed || current.unopened !== null) return Promise.resolve(null)
    if (("session" in conv ? current.session?.id === conv.session : current.session !== null) && current.uploadScope !== null) return Promise.resolve(current.uploadScope)
    return new Promise(resolve => setAwaiting(before => new Set([...before, resolve])))
  }

  const booting = createMemo(() => new Proxy(served(), {
    get: (target, key, receiver) => key === "status" ? "booting" : Reflect.get(target, key, receiver),
  }))
  const state: Accessor<ChatState> = createMemo((): ChatState => {
    const now = served()
    return starting() > 0 && now.status === "idle" ? booting() : now
  })

  createEffect(
    on(() => served().status, (status) => {
      if (status !== "idle") setStarting(0)
    }, { defer: true }),
  )

  const opens = (effect: Call<unknown>) => {
    setStarting((held) => held + 1)
    verb(effect, () => setStarting((held) => Math.max(0, held - 1)))
  }

  const verb = (effect: Call<unknown>, done?: () => void) => {
    setRefused(null)
    run(
      effect,
      (failure) => {
        setRefused(failure)
        done?.()
      },
      () => done?.(),
    )
  }

  createEffect(
    on(() => state().session?.id, () => {
      closePreview()
    }, { defer: true }),
  )

  ui.uploadScope.bind(() => state().uploadScope)

  return {
    state,
    rows,
    lanes,
    entry,
    earlier,
    earlierLoading,
    loadEarlier,
    ui,
    refused,
    pendingSends,
    refuse: (reasons) =>
      setRefused(
        reasons.length === 0
          ? null
          : new UsageFailure({ reason: reasons.join("\n") }),
      ),
    send: async (text, attachments, context, steer) => {
      setPendingSends(count => count + 1)
      try {
        setRefused(null)
        const scope = await sendingScope()
        if (scope === null) {
          setRefused(new UsageFailure({ reason: "The chat didn't open. Your message was kept." }))
          return false
        }
        const outcome = await runAsync(chatWire().procedures.conversation.send({
          conv,
          scope,
          text,
          attachments,
          context,
          ...(steer === true ? { steer: true } : {}),
        }))
        if (outcome._tag === "Success") return true
        setRefused(outcome.failure)
        return false
      } finally {
        setPendingSends(count => count - 1)
      }
    },
    attach: (file, progress) =>
      new Promise<Uploaded>((resolve) => {
        const asked = state().uploadScope
        if (asked === null) return resolve({ _tag: "gone" })
        run(
          attaching(file, (chunk) => chatWire().procedures.conversation.attach({ ...chunk, conv, uploadScope: asked }), {
            progress: (bytes) => {
              if (state().uploadScope === asked) progress?.(bytes)
            },
          }),
          (failure) => resolve({ _tag: "refused", failure }),
          (stored) => {
            if (state().uploadScope !== asked) return resolve({ _tag: "gone" })
            ui.previews.remember(stored.name, file, asked)
            resolve({ _tag: "stored", stored })
          },
        )
      }),
    resend: (id) => verb(chatWire().procedures.conversation.resend({ conv, scope: state().uploadScope, id })),
    signIn: (method) => verb(chatWire().procedures.conversation.signIn({ conv, scope: state().uploadScope, method })),
    signInInput: (text) => verb(chatWire().procedures.conversation.signInInput({ conv, scope: state().uploadScope, text })),
    signInCancel: () => verb(chatWire().procedures.conversation.signInCancel({ conv, scope: state().uploadScope })),
    takeBack,
    setSetting: (agent, session, config, value, done) => verb(chatWire().procedures.conversation.setSetting({ agent, session, config, value }), done),
    setModel: (agent, session, value, done) => verb(chatWire().procedures.conversation.setModel({ agent, session, value }), done),
    cancel: () => verb(chatWire().procedures.conversation.cancel({ conv, scope: state().uploadScope })),
    loadSession: (agent, session) => options.visit?.({ agent, session }),
    scope: (agent, session, plugin, pick) =>
      chatWire().procedures.conversation.scope({ agent, session, plugin, pick }).pipe(Effect.asVoid, Effect.mapError(error => ({ reason: String(error) }))),
    reopen: () => opens(chatWire().procedures.conversation.reopen({ conv, scope: state().uploadScope })),
    answer: (id, answers, done) =>
      verb(chatWire().procedures.conversation.answer({ conv, scope: state().uploadScope, id, answers }), done),
    decline: (id, done) => verb(chatWire().procedures.conversation.decline({ conv, scope: state().uploadScope, id }), done),
  }
}
