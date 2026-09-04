/**
 * CHAT'S OWN SURFACE — the conversation, the roster, and the fourteen verbs, in
 * chat's own package, under chat's own sibling key.
 *
 * ## What this is not, any more
 *
 * It was FOUR members and a verb set spread through `@olai/surface`'s own spec:
 * a `chat` cell, an `agents` cell, a `transcript` collection, a `saying`
 * collection and a `procedures.chat` block, sitting in the middle of core's API
 * with nothing in the key to say whose they were. Every consumer read them off
 * the composed spec as though they were olai's, and `@olai/server`'s `faces.ts`
 * carried fourteen `"chat.*": "tool"` rows in a general package's allowlist.
 *
 * `olai-plugin-kolu`'s module argues the shape in full and it is inherited whole
 * here: `composeSurfaceContracts` takes a keyed map of STANDALONE surfaces and
 * re-walks each one at `surface/<key>/`, so the cell called `chat` in this file
 * is `surface/chat/chat/get` on the wire with no name arithmetic anywhere. The
 * sibling key IS the plugin's own {@link name}.
 *
 * ## AND IT COSTS THE MCP FACE NOTHING, which is the negative worth recording
 *
 * The ruling that took this lane accepted an MCP rename as the price. It turned
 * out to have no subject: not one chat member was ever on the MCP or the agent
 * face (`@olai/server`'s `faces.ts` — the five core resources, the ops, git and
 * search tools, and no chat member), so no client's tool names or URIs move, and
 * the sibling grammar stays unminted on `surface://`. What moves is the BROWSER
 * face, which is the tab's own client and re-dials on a roster change anyway.
 *
 * ## THIS ENTRY'S OWN FENCE, inherited whole
 *
 * The composed group is on the static graph of everything that reads the surface
 * — the browser bundle and the server both. So this module may import the
 * framework, `effect`, `@olai/acp/wire`, `@olai/format` and its own wire slice
 * and NOTHING ELSE: no `solid-js`, which would put a UI runtime on the server's
 * graph, and nothing that speaks ACP's transport, which would put a subprocess
 * on the browser's. `@olai/bundle`'s `fence.test.ts` walks this door's whole
 * closure and asserts it rather than trusting this paragraph.
 */

import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

import { Agents, NO_AGENT_ROSTER, sameAgentRoster } from "./wire/agents.ts"
import {
  AskAnswer,
  AttachChunk,
  Attached,
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatState,
  Conversation,
  Listed,
  Saying,
  SessionInfo,
} from "./wire/members.ts"

/** The sibling key, the preferences row, the docs slug, and the word
 *  `--plugins` takes. Spelled once, here — and because the sibling key IS the
 *  wire prefix, the name and every tag it appears in cannot drift apart. */
export const name = "chat"

/**
 * THE FOUR MEMBERS AND THE FOURTEEN VERBS, as a surface of their own.
 *
 * The doc blocks travelled with the declarations, because they argue what a
 * member IS: what a `deltas` collection promises a late joiner, why the row
 * still being said is a second member rather than a second delivery of the
 * first, and why `resend` acts on a ROW where every other verb acts on the
 * conversation.
 */
export const surface = defineSurface({
  cells: {
    state: {
      schema: ChatState,
      default: CHAT_OFF,
      verbs: ["get"],
      /** A COMMAND AND A TOOL SERVER ARE EACH THEIR `name` — the two arrays
       *  this cell carries, and both spell their identity the same way
       *  (`./wire/members.ts`'s `Command.name` and `ChatServer.name`, required and
       *  non-nullable).
       *
       *  This cell has no `equals`, and it moves for reasons that have nothing
       *  to do with either list: a turn going `idle → thinking`, a `usage`
       *  update per report, an `asking` count. Every one of those frames used
       *  to replace every command and every server row — so
       *  `chat/Roster.tsx`'s `<For each={servers()}>`, which is keyed by
       *  reference, rebuilt the panel a reader was in the middle of reading,
       *  mid-turn, on every token report. The roster is drawn on EVERY
       *  conversation now rather than only on a broken one, so what that key
       *  buys has gone from rare to permanent. */
      arrayKey: "name",
    },
    agents: {
      schema: Agents,
      default: NO_AGENT_ROSTER,
      verbs: ["get"],
      equals: sameAgentRoster,
      /** A ROW IS ITS NODE'S `id`, which is exactly what identity means here:
       *  the node is the durable thing and the session is cattle, so a row
       *  whose session was swapped is the same row with a new binding rather
       *  than a new row. Without a key, a frame that moved one agent's last
       *  line replaced every other row of the sidebar — and the sidebar keys
       *  the roster by this same id (`agents/Agents.tsx`), so a rename moves
       *  the row it renames. */
      arrayKey: "id",
    },
  },
  collections: {
    /** The conversation. `deltas` is the whole point — see {@link ./wire/members.ts}:
     *  one subscription carries both the history a late joiner needs and the
     *  frames a live tab is watching. Read-only on the wire: a transcript is
     *  something that HAPPENED, and the only way to add to it is to prompt. */
    transcript: {
      keySchema: Schema.String,
      schema: ChatEntry,
      verbs: ["keys", "get", "deltas"],
    },
    /**
     * THE ROW THAT IS STILL BEING SAID, in pieces — the transcript's second
     * member and the reason a streaming answer costs the wire the answer
     * ({@link ./wire/members.ts}'s `Saying`, which argues the whole thing).
     *
     * A SECOND MEMBER rather than a second delivery of the first, and the
     * argument is the one the header above makes about events: the two carry
     * different facts. `transcript` carries ROWS, whole, and answers a late
     * joiner with the conversation; this carries the PIECES of the one row
     * still growing, which nobody needs a history of — a reader that missed
     * them has the text in the row. So the expensive promise is kept once, by
     * the member that has to keep it, and the cheap frames are cheap.
     *
     * `deltas` and nothing else. There is no key here anybody looks up: a
     * piece is found by the row it names, off the frames as they arrive, and
     * `keys`/`get` would be two verbs offered to nobody. Read-only on the
     * wire for `transcript`'s reason, one step sharper — this is not even
     * something that happened, it is how something that is happening is
     * being delivered.
     */
    saying: {
      keySchema: Schema.String,
      schema: Saying,
      verbs: ["deltas"],
    },

  },
  procedures: {
    conversation: {
      /** Prompt the agent. Answers as soon as the turn is ACCEPTED, not when
       *  it ends: what the panel draws comes back on the transcript, so every
       *  open tab stays in step and a slow turn does not hold a call open. */
      send: {
        input: Schema.Struct({
          text: Schema.String,
          /**
           * INTERRUPT the turn the agent is already running with this, rather
           * than taking a place behind it.
           *
           * The one deliberate gesture, and it is a field on `send` rather than
           * a verb of its own because it is the SAME message either way: the
           * row is written, the words go out, and what differs is which turn
           * hears them. Two procedures would be two places to keep the
           * attachment claim, the node resolution and the row in step.
           *
           * Absent is the default and the default is to WAIT — plain enter
           * takes a place in the agent's own queue, which is what makes an
           * interruption something somebody chose. It costs nothing on an idle
           * agent (there is no turn to interrupt, and the message starts one
           * either way) and nothing on an agent that cannot be interrupted (it
           * is sent as the ordinary prompt it would have been), so a stale tab
           * that sends it cannot lose anybody's words.
           */
          steer: Schema.optionalKey(Schema.Boolean),
          /** The pictures this message carries, as the PATHS `attach`
           *  answered with. Absent is the same as empty — a prompt with no
           *  picture is every prompt olai had until now, and a caller should
           *  not have to spell an empty list to say so.
           *
           *  Paths and not bytes, because that is the whole design: the file
           *  is already on disk by the time this is called, the agent is
           *  handed the path in its prompt and reads it itself. They are
           *  re-checked against the conversation's own directory here — a
           *  path that arrived over the wire names nothing on its own. */
          attachments: Schema.optionalKey(Schema.Array(Schema.String)),
          /** The nodes this message is ABOUT, by ID — what "ask agent" on a
           *  row armed the composer with.
           *
           *  IDS AND NOTHING ELSE, which is the decision worth naming: a
           *  browser drew a row from a frame that is already some
           *  milliseconds old, so a title or a `file:line` it sent would be
           *  its account of the set rather than the set's. The id is the one
           *  thing it can say that the server can resolve — and resolving it
           *  is what the server does, against the same reading a keystroke's
           *  write is judged against, so what reaches the agent is the node
           *  as it IS. An id nothing declares refuses the send: the message
           *  was about that node, and sending it without one would be asking
           *  the agent to guess which. */
          context: Schema.optionalKey(Schema.Array(Schema.String)),
        }),
        error: ChatFailure,
      },
      /**
       * Try a message the agent would not take AGAIN — `id` is the `user`
       * row's own key, the one carrying `delivery: "refused"`.
       *
       * The row is the only copy of those words, so retrying from it is the
       * only retry that can be whole: the server still holds the prompt it
       * failed to deliver, pictures and node lines and all, where a browser
       * re-reading the row would have the names of the pictures and not their
       * paths. What lands is the same message, not a reconstruction of it.
       *
       * A person's click and nothing else drains this. Nothing retries on its
       * own, which is the difference between a row that says it did not go and
       * the queue this replaced: an undelivered message stays on screen, in the
       * conversation, until somebody decides what to do with it.
       *
       * It REFUSES for a row whose delivery went `unanswered`: the server kept
       * no prompt for one, because an agent that went quiet may have the
       * message already and a second copy is the one outcome this must not be
       * able to produce.
       */
      resend: {
        input: Schema.Struct({ id: Schema.String }),
        error: ChatFailure,
      },
      /** One chunk of a picture, into the conversation's tmp directory.
       *
       *  A PROCEDURE rather than an upload route, which is the decision worth
       *  naming: a procedure inherits the origin gate and the session the
       *  listener already enforces for the websocket, where a second HTTP
       *  route would need its own copy of both. And a SIBLING of `send`
       *  rather than a widening of it, because the two answer different
       *  questions — `attach` says where the bytes landed, `send` says a turn
       *  was accepted — and a file is N calls to one send. */
      attach: {
        input: AttachChunk,
        output: Attached,
        error: ChatFailure,
      },
      /** Stop the turn in flight. Legal while the agent is still booting — the
       *  cancel is remembered and sent with the prompt. */
      cancel: { error: ChatFailure },
      /** Start a fresh conversation WITH the named agent — one of
       *  {@link ChatState.roster}'s ids. The agent-side context goes away and
       *  the transcript is emptied.
       *
       *  The agent is REQUIRED, and that is the ruling rather than an
       *  ergonomic: every new chat asks which one, and no default is
       *  remembered across conversations. A verb that could be called without
       *  one would be the place a default grew back. Refuses an id this machine
       *  does not have, which is what a tab open across a restart can send. */
      newSession: {
        input: Schema.Struct({ agent: Schema.String }),
        error: ChatFailure,
      },
      /**
       * START A NODE AGENT'S SESSION: open a fresh conversation with the engine
       * that node's `agent-session` property already names, and write the
       * session it opened back onto the property.
       *
       * The `•••` menu's verb, and the one gesture in olai that binds a node
       * agent to a conversation. It is HERE — one procedure rather than a
       * `newSession` the browser follows with an `edit.apply` — because a
       * browser cannot learn which session was opened: {@link newSession}
       * answers with nothing, and a tab watching the state cell for a session
       * to appear would be racing every other tab's turn.
       *
       * SESSION FIRST, PROPERTY SECOND, and the order is the guarantee: the
       * vault never names a conversation that does not exist. The other order
       * fails the other way — a property pointing at a session that was never
       * opened, on a row whose door refuses for ever.
       *
       * WHICH ENGINE is the browser's to say, for {@link newSession}'s reason
       * word for word: there is no default anywhere in this app, and a verb
       * that could be called without one would be where a default grew back.
       * What the menu sends is the engine the node's own property names, which
       * is the only reading of *that node's agent* — a node with no property is
       * not a node agent, and the menu does not offer this on one.
       *
       * Refuses whatever either half refuses: an engine this machine does not
       * have, an agent that would not start, and every reason the ops layer has
       * for declining to write a property — a record that is gone, a file that
       * would not take the write.
       */
      startAgentSession: {
        input: Schema.Struct({
          /** The node whose property is about to name the session — the id the
           *  roster answers with. */
          node: Schema.String,
          /** ... and the engine to open it with, off that node's property. */
          agent: Schema.String,
        }),
        error: ChatFailure,
      },
      /**
       * ASSIGN AN EXISTING CONVERSATION TO A NODE: write `agent-session:
       * <engine>:<session>` onto that node, for a chat that already exists.
       *
       * The migration gesture, and the mirror image of {@link
       * startAgentSession}: there, the session is opened and the property
       * follows; here BOTH ALREADY EXIST and what is missing is the sentence
       * that joins them. Nothing moves on disk — the session file stays
       * wherever its agent keeps it — and the conversation becomes that node
       * agent's current session with its context intact.
       *
       * THE ENGINE IS THE CHAT'S OWN, and the value is written whole: a session
       * id means nothing to the wrong agent, so the pair travels together and a
       * node that named a DIFFERENT engine is re-pointed rather than half
       * rewritten. A property naming one engine and another engine's
       * conversation would be a node agent nobody could open.
       *
       * IT IS HERE rather than being an `edit.apply` from the browser, and the
       * reason is not the write: it is that assigning has a SECOND half this
       * machine keeps — that this session ARRIVED by assignment, which is what
       * decides the contract it is taught on its next message (`olai-plugin-chat`'s
       * `teaching.ts`). A browser writing the property alone would bind the
       * conversation and lose the distillation order.
       *
       * REFUSES A NODE THAT IS ALREADY TALKING through a conversation, in a
       * plain sentence: one agent, one current session. Replacing a live
       * binding is the *fresh session* affordance, which is
       * {@link startAgentSession} on a bound node and says what happens to the
       * transcript. Refuses whatever the ops layer refuses besides — a record
       * that is gone, a file that would not take the write.
       */
      assignSession: {
        input: Schema.Struct({
          /** The node that is about to claim the conversation — the id a
           *  search hit or a roster row answers with. */
          node: Schema.String,
          /** WHOSE conversation it is: one of {@link ChatState.roster}'s ids,
           *  off the row in the list ({@link SessionInfo}). */
          agent: Schema.String,
          /** ... and WHICH conversation, by the id that agent stores it
           *  under. */
          session: Schema.String,
        }),
        error: ChatFailure,
      },
      /** Answer the question the panel is asking ({@link ChatState.talking}'s
       *  `asking` arm):
       *  THIS agent, now open the conversation you would have opened.
       *
       *  Not {@link newSession} with the same argument. A boot that stopped to
       *  ask has not asked for a new conversation — it was stopped before it
       *  could come back to the one this directory was in — so this opens that
       *  agent's remembered conversation, or its most recent, and only mints a
       *  fresh one where it has none. `+ new` is the verb that always means
       *  fresh. */
      chooseAgent: {
        input: Schema.Struct({ agent: Schema.String }),
        error: ChatFailure,
      },
      /** Move to one of the stored conversations. The transcript is replaced by
       *  the replay, because a transcript of a session you are not in is a lie.
       *
       *  WITH the agent whose conversation it is, which the row itself carries
       *  ({@link SessionInfo}). The list spans every installed agent now, so a
       *  row picked out of it may belong to the one this panel is NOT talking
       *  to — and opening it is a change of agent as well as of conversation,
       *  exactly the change {@link newSession} makes. A session id means
       *  nothing to the wrong agent, so this is not a detail the server could
       *  work out from the id. Refuses an agent this machine does not have. */
      loadSession: {
        input: Schema.Struct({ agent: Schema.String, id: Schema.String }),
        error: ChatFailure,
      },
      /** Try the OPEN that was refused again — the one the panel is holding a
       *  {@link ChatState.unopened} for, whichever it was.
       *
       *  It takes no argument, and that is the point rather than an omission: a
       *  boot chooses its own conversation, so a browser naming one would be
       *  asking for something nobody asked for. The server kept the attempt,
       *  the way it keeps the prompt behind an undelivered message. Refuses
       *  when there is nothing waiting to be opened again. */
      reopen: { error: ChatFailure },
      /** EVERY installed agent's stored conversations for this directory,
       *  merged newest-first, each row saying whose it is.
       *
       *  The one this panel is talking to is asked every time, because its list
       *  is the only one that is right and it is already running. The others
       *  are asked when their answer is stale ({@link ../../plugins/chat/src/listings.ts}),
       *  one at a time — opening a list is not a reason to start three
       *  subprocesses at once. */
      sessions: {
        output: Listed,
        error: ChatFailure,
      },
      /** Answer a question the agent asked — the `ask` entry named by `id`,
       *  filled in. The turn is blocked until this or {@link decline} arrives,
       *  which is why both are verbs rather than a write to the transcript. */
      answer: {
        input: Schema.Struct({
          id: Schema.String,
          answers: Schema.Array(AskAnswer),
        }),
        error: ChatFailure,
      },
      /** Dismiss one, honestly: the agent is told a person declined to answer,
       *  and never handed an answer nobody gave. */
      decline: {
        input: Schema.Struct({ id: Schema.String }),
        error: ChatFailure,
      },
      /**
       * THIS CONVERSATION WAKES ON THAT FILE, for that plugin's doorbell — or,
       * with `file: null`, on nothing.
       *
       * The one verb behind the strip's scope control. Core stores the triple,
       * draws the row and draws the picker; a running plugin says what the wake
       * IS (`../plugins.ts`' `wake`) and, having been given the conversations, is
       * the only thing that ever rings.
       *
       * MANUAL, AND PER CONVERSATION. There is no serve-level default and no way
       * to arrive at one: a conversation nobody has scoped has no row, and the
       * strip says the doorbell is off. That is a ruling and not a starting
       * position — a machine that woke a conversation nobody pointed at a file
       * would be the old background watch with a better address.
       *
       * ... AND IT IS THE BROWSER'S ALONE. `@olai/server`'s `faces.ts` names it
       * on `BROWSER` and deliberately nowhere else, so an agent cannot set what
       * wakes it. That is the whole of "no agent-settable op" and it is physics
       * rather than a promise: `faces.test.ts` pins the agent face as an exact
       * set, so a row added there is a red suite.
       */
      scope: {
        input: Schema.Struct({
          /** WHICH conversation, as the exact pair {@link loadSession} takes.
           *  A session id means nothing to the wrong agent, and the panel's own
           *  session can move under a picker somebody left open — a boot opens
           *  one with no verb called at all — so a scope that meant "whichever
           *  one is in front of me" would sometimes attach a person's pick to a
           *  conversation they were not looking at. */
          agent: Schema.String,
          session: Schema.String,
          /** WHOSE doorbell — one of the roster's built names, as DATA. This
           *  file spells no plugin; the value came off `../plugins.ts`' rows,
           *  which came off the registry. Refused when this serve composed no
           *  such plugin, or when the one it names declares no wake — the same
           *  refusal {@link chooseAgent} gives an id this machine does not have.
           */
          plugin: Schema.String,
          /** The file to filter by — root-relative and `/`-spelled, the one
           *  spelling every path member here uses. What it MEANS is the
           *  plugin's business and core never opens it.
           *
           *  `null` CLEARS the scope, and is how a doorbell is turned off. Not a
           *  second verb, because there is one fact here and it has an empty
           *  value: a `forget` beside a `set` would be two ways to write one
           *  row and a question about which of them a fresh pick goes through. */
          file: Schema.NullOr(Schema.String),
        }),
        error: ChatFailure,
      },
    },
  },
})

/**
 * WHICH FACE SEES WHAT — this plugin's own `ExposeMap`, written against this
 * plugin's own spec.
 *
 * ## THE BROWSER'S ALONE, ALL EIGHTEEN, and that is not this file's decision to
 * ## make — it is `@olai/server`'s, read off and moved unchanged
 *
 * Every one of these members was on `BROWSER` and on no other face before this
 * lane, and the arguments travelled with them. The conversation and the row
 * still being said are THE HUMAN's session: a render-shaped consumer watches a
 * turn happen, and an agent talking to this store IS the other end of that
 * conversation rather than a reader of it. The roster is a paint instruction for
 * a column — the vault half of it is `prop:chat-agent-session`, which an agent
 * types into `search_nodes` and is answered with the NODES, and what this member
 * adds is the overheard line and a state dot. And the fourteen verbs are
 * gestures a person made in a panel: an agent that wanted to send itself a
 * message would be the strangest loop in this tree.
 *
 * `scope` is that line drawn hardest, and its absence from the agent face is
 * load-bearing rather than an omission: the ruling is that a doorbell is MANUAL
 * and per conversation, with no serve-level default and no agent-settable op.
 * This map is where that stops being a promise and becomes physics.
 *
 * There is no AGENT map, and its absence is the decision rather than a gap:
 * `exposeFaces` denies a sibling with no map in full, which is the default-deny
 * this plugin wants. A face's own composition names which maps it asks each
 * plugin for.
 */
export const faces = {
  browser: {
    state: "resource",
    agents: "resource",
    transcript: "resource",
    saying: "resource",
    "conversation.send": "tool",
    "conversation.resend": "tool",
    "conversation.attach": "tool",
    "conversation.cancel": "tool",
    "conversation.newSession": "tool",
    "conversation.startAgentSession": "tool",
    "conversation.assignSession": "tool",
    "conversation.chooseAgent": "tool",
    "conversation.loadSession": "tool",
    "conversation.reopen": "tool",
    "conversation.sessions": "tool",
    "conversation.answer": "tool",
    "conversation.decline": "tool",
    "conversation.scope": "tool",
  },
} as const

/**
 * ...AND THE VOCABULARY THOSE MEMBERS CARRY, through this one door.
 *
 * A transcript entry, the row still being said, the conversation's state, the
 * roster's row and the fifteen readings over them are declared next door
 * ({@link ./wire/members.ts}, {@link ./wire/agents.ts}) and re-exported here so a
 * consumer opens ONE door for chat's wire — which is the arrangement
 * `@olai/surface` had for them until this lane, minus the part that was wrong:
 * they were in core's spec, so every reader took them for olai's own.
 *
 * WHAT DOES NOT COME THROUGH IT is the vocabulary chat only PASSES ON.
 * `OpFailure`, `UsageFailure`, `BusyFailure`, `isOpFailure` and `kindOf` are
 * `@olai/format`'s; `AskAnswer`, `AskChoice`, `AskField`, `AskOutcome`,
 * `FileDiff`, `Usage` and `YES_NO` are `@olai/acp/wire`'s. A reader that wants
 * one of those goes to the package that owns it — a plugin re-publishing the
 * floor's words would put the fence's own arrow through: a general package
 * importing a refusal shape from a row is a general package importing a row.
 */
export * from "./wire/agents.ts"
export * from "./wire/members.ts"
