/** vault-plugins owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { BuiltPlugin } from "@olai/surface"
import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
export const surface = defineSurface({
  procedures: {
    plugins: {
      /**
       * TURN A PLUGIN ON — the one verb in this product where a person is
       * saying yes to CODE, and the whole of what the page's primary button
       * does.
       *
       * ## It is two writes, because it is two facts
       *
       * `approved: <version>` is *I have read this and it may run*; `on: yes`
       * is *and I want it running*. They were one gesture when a definition's
       * switch lived in this process's memory and an approval was the only
       * durable thing about it. They are both durable now, both on the plugin's
       * node in `_olai/Settings.olai`, and both written here in one write so a
       * press cannot land half of itself.
       *
       * ## The version is the input, and that is the whole safety of it
       *
       * The page draws the source it was sent and sends back the version it
       * drew. A serve whose reading has moved on refuses, naming the change,
       * rather than approving what is there NOW — because what a person read
       * and what is on disk are two things, and the gap between them is exactly
       * one revision wide. An approval that named only the plugin would be an
       * approval of whatever the file said by the time the press arrived.
       *
       * `forever` is the second of the two rulings (the human, 2026-09-05):
       * `approved: <hash>` for one version, `approved: always` for every later
       * one.
       *
       * ## THE BROWSER'S ALONE
       *
       * An agent that could approve a plugin could approve the plugin it just
       * wrote, which is the whole of the boundary this lane has. {@link faces}
       * below names it on that face and no other, and its suite pins the agent
       * face as an exact set.
       */
      approve: {
        input: Schema.Struct({
          /** The plugin's word — its folder's name. */
          name: Schema.String,
          /** The version this person READ — `BuiltPlugin.source.version`, sent
           *  back. */
          version: Schema.String,
          /** Whether every later version is approved too, or only this one. */
          forever: Schema.Boolean,
        }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      /**
       * ALWAYS TRUST CHANGES — and the way back out of it.
       *
       * A SECOND VERB rather than {@link approve}'s `forever`, because the two
       * gestures differ in what else they do. **Turn on** is a decision about
       * code AND a decision to run it, which is why it writes both words. The
       * menu item that says *Always trust changes* is about reading only: it
       * was spelled as an approval with `forever`, so choosing it on a plugin
       * somebody had switched off turned it back on — a second decision, made
       * silently, out of a menu whose words never mentioned it.
       *
       * `trusting: false` is the reverse the menu never offered. Taking the
       * standing approval away pins the plugin at the version it is running,
       * because the person HAS read that one; what they are saying is that
       * they want to read the next.
       *
       * ## IT CARRIES THE VERSION, for {@link approve}'s reason exactly
       *
       * Both directions write `approved`, so both are a person saying yes to
       * code, so both send back the version the page drew and are refused if
       * the reading has moved on. Without it, *Always trust changes* on a
       * **Ready for you** page was an approval of this version and every later
       * one — the one decision this product is careful about — made with the
       * stale-source refusal skipped, out of a menu. Starting is refused for a
       * plugin that cannot start, like an approval; stopping is refused for a
       * plugin that is not trusting anything, because there is nothing to take
       * away. `./source.ts`'s `refusalFor` is where all three are read.
       */
      trust: {
        input: Schema.Struct({
          name: Schema.String,
          /** The version this person READ, as {@link approve} takes it. */
          version: Schema.String,
          /** Whether every later version may run unread. */
          trusting: Schema.Boolean,
        }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      /**
       * REMOVE A PLUGIN — the folder's files and the decision about them.
       *
       * The halves are deliberately not in the sidebar's file tree, so nothing
       * else in the app can delete them: a person who made a plugin in one
       * sentence would otherwise need a terminal to be rid of it. The page is
       * where the folder is a thing you can see, so the verb is the page's.
       *
       * IT TAKES THE CONSENT WITH IT, unlike a folder deleted by hand, which
       * leaves its node where the decision was made. Pressing **Delete** is
       * ending the plugin, and a settings file collecting the approvals of
       * every plugin anybody ever deleted is a file nobody can read.
       *
       * THE BROWSER'S ALONE, for {@link approve}'s reason in reverse: an agent
       * that could delete a plugin could delete the one a person is reading.
       */
      remove: {
        input: Schema.Struct({ name: Schema.String }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      /**
       * MINT A PLUGIN FROM ONE SENTENCE — what ⌘K → **New plugin** presses, and
       * the only verb here that creates anything.
       *
       * Three acts under one call, in this order and for this reason: the WORD
       * is judged first, because a refusal must arrive before anything is on
       * disk; the README is written next, carrying the person's own sentence,
       * because that is what makes the folder a plugin the page can draw; and
       * the builder is started LAST, because a conversation that was started
       * for a folder that was never created is a conversation about nothing.
       *
       * THE ANSWER CARRIES THE ADDRESS rather than navigating: the caller is a
       * palette level in a tab, and where a press lands is the tab's business.
       *
       * A SERVE WITH NO CHAT still mints. `builder` comes back `null`, the page
       * says no agent is available, and the folder is a folder somebody can
       * write by hand — which is the honest answer and not a failure of this
       * call.
       */
      mint: {
        input: Schema.Struct({
          /** What the person asked for, in their own words. It becomes the
           *  README's first paragraph and the builder's first message. */
          sentence: Schema.String,
          /** The name they accepted or edited at the second level. The folder
           *  word is its slug. */
          title: Schema.String,
          /** Which engine builds it — an id from chat's engines, or empty for a
           *  serve that offers none. */
          engine: Schema.String,
        }),
        output: Schema.Struct({
          /** The folder word that was taken. */
          name: Schema.String,
          /** Where to go: `/plugins/<word>`. */
          address: Schema.String,
          /** The conversation building it, or `null` where no agent could be
           *  started — with {@link refusal} saying why. */
          builder: Schema.NullOr(Schema.String),
          refusal: Schema.NullOr(Schema.String),
        }),
        error: OpFailure,
      },
      /**
       * ASK THE BUILDER FOR SOMETHING — *Ask Claude to fix it* under a fault,
       * and *Ask for a change* on a plugin that is running.
       *
       * The words go into the conversation bound to this plugin, through the
       * door chat offers for speaking into one. This row composes the sentence
       * for the fault case so that a person pressing one button hands over the
       * fault VERBATIM — an agent told "it broke" has to go and find out what,
       * and the serve already knows.
       *
       * `false` is *there is no conversation to speak into*, which is a serve
       * with chat off or a plugin nobody built with an agent. The page does not
       * offer the button in either case; this answers honestly anyway rather
       * than failing, because a roster can move between a draw and a press.
       */
      ask: {
        input: Schema.Struct({
          name: Schema.String,
          /** What to say. Empty asks this row to compose the fault sentence. */
          said: Schema.String,
        }),
        output: Schema.Struct({
          /** The conversation it went to, or `null` if there was none. */
          builder: Schema.NullOr(Schema.String),
        }),
        error: OpFailure,
      },
      /**
       * ASK OLAI TO LOOK AT A PLUGIN THIS VAULT DEFINES — the agent's feedback
       * loop, and the only thing on that face that touches a fiber.
       *
       * It MOUNTS NOTHING BY ITSELF. What it does is read the folder as it
       * stands and answer what became of it, which for a plugin nobody has
       * approved is `pending` — the state a person is being asked a question
       * in. So the loop an agent has is: read `guide`, write the three files
       * with `write`, call this, and be told either that it is running or that
       * a person has not decided yet.
       *
       * A REFUSAL IS ONE THING: no such folder. Everything else — a half that
       * will not compile, a name already taken, an `apply` that threw — is a
       * STATE with a sentence on it, because those are answers about a plugin
       * rather than failures of this call, and an agent that got an error back
       * would have to parse prose to find out which.
       */
      run: {
        input: Schema.Struct({
          /** The folder's name under `plugins/`. */
          name: Schema.String,
        }),
        output: Schema.Struct({
          name: Schema.String,
          /** The content hash of both halves as they stand. */
          version: Schema.String,
          /** One of `@olai/surface`'s plugin states — `pending` until somebody
           *  approves this version. */
          state: Schema.String,
          /** Whether this version is approved. */
          approved: Schema.Boolean,
          /** Why it is not running, in a whole sentence, where there is one. */
          fault: Schema.optionalKey(Schema.String),
          configurationValues: BuiltPlugin.fields.configurationValues,
        }),
        error: OpFailure,
      },
      /**
       * ...AND STOP ONE.
       *
       * NARROWED TO PLUGINS THE VAULT DEFINES, and the narrowing is the whole
       * reason this is not core's `plugins.set` on another face: an agent that
       * could turn a row off could turn off the row that seats it, the row that
       * watches its writes, or the row whose tools it is holding — and then not
       * be able to turn any of them back on, because the face it was calling
       * through went with them (`@olai/surface/host`'s `hostFaces` argues it
       * where the switch is). A plugin the vault defines is different in the
       * one way that matters: it is code the agent wrote, in a folder the agent
       * can write, and retracting it is deleting the folder.
       *
       * IT IS DURABLE NOW, and the tool says so. Stopping used to last as long
       * as the process, because enablement was a set in memory; it is `on: no`
       * on the plugin's settings node, so a restart comes back to it.
       */
      stop: {
        input: Schema.Struct({ name: Schema.String }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
      /**
       * HOW TO WRITE ONE — the authoring guide, shipped in the binary.
       *
       * An agent working in somebody's vault has no olai checkout to read, so
       * the page that tells a person how a plugin is written has to be
       * reachable as an ANSWER rather than as a file. This is that page, same
       * words, kept in lockstep with `docs/dynamic-plugins.md` by a test rather
       * than by habit (`./guide.test.ts`).
       */
      guide: {
        input: Schema.Struct({}),
        output: Schema.Struct({
          /** The whole guide, markdown, as the doc has it. */
          text: Schema.String,
          /** The three file names a folder takes, so an agent does not have to
           *  read them out of the prose. */
          files: Schema.Struct({ readme: Schema.String, server: Schema.String, browser: Schema.String }),
          /** Where a folder goes. */
          folder: Schema.String,
        }),
        error: OpFailure,
      },
      /**
       * WRITE ONE FILE OF ONE PLUGIN — the author's write door, and the reason
       * an agent needs no vault-path vocabulary to build a plugin.
       *
       * It goes through the ORDINARY write gate: the same planner, the same
       * validation, the same ledger commit as a keystroke. What it adds is the
       * part an agent would otherwise have to get right by hand — the folder,
       * the path, which of the three files is which, and whether that half
       * COMPILES, answered in the same reply so the loop is one call rather
       * than a write and a guess.
       */
      write: {
        input: Schema.Struct({
          /** The plugin's word. Its folder is created if it is not there. */
          name: Schema.String,
          /** Which of the three files: `README.md`, `server.ts`, `browser.tsx`. */
          file: Schema.String,
          /** The file's whole text. */
          text: Schema.String,
        }),
        output: Schema.Struct({
          /** The path that was written, as the set lists it. */
          path: Schema.String,
          /** Whether this half compiles — absent for the README, which is
           *  prose and compiles nothing. */
          compiles: Schema.optionalKey(Schema.Boolean),
          /** Why it does not, verbatim from the builder. */
          why: Schema.optionalKey(Schema.String),
          /** The version of the two halves after this write. */
          version: Schema.String,
        }),
        error: OpFailure,
      },
      /**
       * WHAT A PLUGIN MAY NAME — the registry read before the code is written.
       *
       * An agent writing a plugin against a runtime it cannot see writes
       * against a memory of one. What this answers is every list that decides
       * whether a half will mount at all — the modules olai binds, the services
       * a `needs` may name, the slots a face may hang in, the words already
       * taken — and each of them is READ from the thing that enforces it rather
       * than described beside it.
       *
       * A READ, so it says nothing about who is asking and changes nothing.
       */
      inspect: {
        input: Schema.Struct({}),
        output: Schema.Struct({
          /** The bare module names a plugin's source may import. */
          modules: Schema.Array(Schema.String),
          /** Browser declarations are discoverable without claiming that a
           * particular tab has activated them. */
          services: Schema.Array(Schema.Struct({
            key: Schema.String,
            half: Schema.Literals(["server", "browser"]),
            availability: Schema.Literals(["core", "provided", "declared"]),
          })),
          /** Where a browser half's faces may hang, and what keys each slot. */
          slots: Schema.Array(Schema.Struct({
            name: Schema.String,
            keyedBy: Schema.String,
          })),
          /** The folder a plugin takes, and where its consent is kept. */
          layout: Schema.Struct({
            folder: Schema.String,
            readme: Schema.String,
            server: Schema.String,
            browser: Schema.String,
            settings: Schema.Struct({
              file: Schema.String,
              schema: Schema.String,
              properties: Schema.String,
              reserved: Schema.Array(Schema.String),
            }),
          }),
          /** Every word this serve already has — built rows and vault folders
           *  alike, because a plugin may take neither. */
          taken: Schema.Array(Schema.String),
        }),
        error: OpFailure,
      },
    },
  },
})

/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec, and
 * the one place in the tree where the split between the two faces IS the
 * feature.
 *
 * ## Five verbs are an agent's, because the agent is the author
 *
 * {@link guide} is HOW to write one, shipped in the binary so an agent in a
 * vault with no olai checkout is not writing from memory. {@link inspect} is a
 * READ of what a plugin may name — the modules, the services, the slots, the
 * words already taken — asked before the code is written. {@link write} puts
 * one file of one plugin through the vault's own write gate and answers that
 * half's compile result. {@link run} asks olai to look at a folder and answers
 * what became of it, which for anything nobody has approved is `pending`.
 * {@link stop} turns one off, and is narrowed to VAULT plugins so an agent
 * cannot turn off the row that seats it.
 *
 * ## ...and three are a person's
 *
 * {@link approve} is the one verb in olai that says yes to CODE, and it is also
 * the switch: a plugin a vault defines is source somebody — usually an agent —
 * wrote into the directory this serve is about, and mounting it runs that
 * source with the process's authority. The boundary is a PERSON, at a page,
 * having read what the folder holds. An agent on the face below can write a
 * plugin and can ask what became of it; the one thing it cannot do is be the
 * reader.
 *
 * {@link mint} creates a folder and starts a conversation, which is a person
 * asking for something rather than an agent helping itself to a new row. {@link
 * ask} speaks into that conversation on a person's press.
 *
 * Core's `plugins.set` — the panel's own switch, which turns any row off — is
 * on the browser face there (`@olai/surface/host`'s `hostFaces`). The pair is
 * the whole boundary, and `@olai/server`'s `faces.test.ts` pins the agent face
 * as an EXACT SET so those absences are asserted rather than trusted to nobody
 * having typed them.
 */
export const faces = {
  browser: {
    "plugins.approve": "tool",
    "plugins.trust": "tool",
    "plugins.remove": "tool",
    "plugins.mint": "tool",
    "plugins.ask": "tool",
  },
  agent: {
    "plugins.guide": "tool",
    "plugins.inspect": "tool",
    "plugins.write": "tool",
    "plugins.run": "tool",
    "plugins.stop": "tool",
  },
} as const
