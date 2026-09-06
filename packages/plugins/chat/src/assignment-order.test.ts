/** The old assignment UI could close immediately after dispatch. Stage the
 * actual binding write to show why sending before its reply yielded zero
 * initial contracts; the guarded order must teach exactly one migration. */
import { expect, test } from "bun:test"
import { Deferred, Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { NodeAgent } from "@olai/format"
import type { ChatEntry } from "./wire.ts"
import { QUEUES } from "./agents/legs.testlib.ts"
import { localHarness } from "./local.testlib.ts"
import { forLocalState as sessionsIn } from "./sessions.ts"
import { make } from "./scoped.ts"
import { assignSession } from "./server/binding.ts"

const run = <A,E>(effect: Effect.Effect<A,E>) => Effect.runPromise(effect)
const fixture = join(import.meta.dirname,"fixtures","teaching-agent.ts")

for (const waitForReply of [false,true]) test(`assignment ${waitForReply ? "reply precedes" : "still pending during"} the first prompt`, async () => {
  const cwd = mkdtempSync(join(tmpdir(),"olai-assignment-order-"))
  const local = localHarness()
  const entered = await run(Deferred.make<void>())
  const release = await run(Deferred.make<void>())
  let nodes: NodeAgent[] = []
  const entries = new Map<string,ChatEntry>()
  let booted!: () => void
  let answered!: () => void
  const ready = new Promise<void>(resolve => {booted=resolve})
  const answer = new Promise<void>(resolve => {answered=resolve})
  const chat = await run(make({
    roster:()=>[{id:"opencode",name:"opencode",adapter:{command:process.execPath,args:[fixture]},leg:QUEUES,prompt:{kind:"first-turn"}}],
    engines:()=>[],cwd,tools:()=>null,
    overheard:await run(sessionsIn(local.forDirectory(cwd))),
    nodeAt:id=>nodes.find(node=>node.id===id)??null,
    seatableAt:()=>true,nodes:()=>nodes,
    nearestAt:(id,candidates)=>candidates.has(id)?id:null,
    agentAt:to=>nodes.find(node=>node.engine===to.agent&&node.session===to.session)??null,
    ticket:()=>({bearer:"",release:()=>{}}),
    onState:state=>{
      if(state.status==="idle"&&state.session!==null) booted()
      if(state.status==="idle"&&[...entries.values()].some(row=>row.kind==="agent"&&row.text.includes("where were we?"))) answered()
    },
    onTranscript:change=>{
      for(const [key,row] of change.upserts) entries.set(key,row)
      for(const key of change.removes) entries.delete(key)
      for(const piece of change.appends){const row=entries.get(piece.of);if(row)entries.set(piece.of,{...row,text:row.text+piece.text})}
    },
  }))
  let assignment: Promise<void> | undefined
  try {
    await run(chat.start)
    await ready
    const session = chat.state().session!.id
    assignment = run(assignSession(chat,{
      key:()=>"agent-session",boundAt:()=>null,
      write:()=>Effect.gen(function*(){
        yield* Deferred.succeed(entered,undefined)
        yield* Deferred.await(release)
        nodes=[{id:"lane",title:"a lane nobody has put an agent on",file:"lanes.olai",engine:"opencode",session,memory:0}]
      }),
    },{node:"lane",agent:"opencode",session}))
    await run(Deferred.await(entered))
    expect(nodes).toEqual([])
    if(waitForReply){await run(Deferred.succeed(release,undefined));await assignment}
    await run(chat.send("where were we?",[],[]))
    await answer
    const notices=[...entries.values()].filter(row=>row.kind==="notice")
    const heard=[...entries.values()].filter(row=>row.kind==="agent").map(row=>row.text).join("\n")
    expect(notices).toHaveLength(waitForReply?1:0)
    expect(heard.includes("has been ASSIGNED")).toBe(waitForReply)
    if(!waitForReply){await run(Deferred.succeed(release,undefined));await assignment}
  } finally {
    await run(Deferred.succeed(release,undefined))
    await assignment
    await run(chat.stop)
    rmSync(cwd,{recursive:true,force:true})
  }
},20_000)
