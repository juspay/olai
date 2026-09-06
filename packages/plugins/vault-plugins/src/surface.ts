/** vault-plugins owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
export const surface = defineSurface({
procedures: {
plugins: { /**
       * APPROVE A PLUGIN THE VAULT DEFINES — the one verb in this product where
       * a person is saying yes to CODE.
       *
       * ## The version is the input, and that is the whole safety of it
       *
       * The panel draws the source it was sent and sends back the version it
       * drew. A serve whose reading has moved on refuses, naming the change,
       * rather than approving what is there NOW — because what a person read and
       * what is on disk are two things, and the gap between them is exactly one
       * revision wide. An approval that named only the plugin would be an
       * approval of whatever the file said by the time the press arrived.
       *
       * `forever` is the second of the two rulings (the human, 2026-09-05):
       * `approved: <hash>` for one version, `approved: always` for every later
       * one. Both are written as a PROPERTY on the plugin's own node, through
       * the ordinary write door — so the decision travels with the vault and is
       * versioned by the ledger like the source it is about.
       *
       * ## THE BROWSER'S ALONE
       *
       * For `plugins.set`'s reason, sharpened: an agent that could approve a
       * plugin could approve the plugin it just wrote, which is the whole of the
       * boundary this phase has. `./faces.ts` names it on that face and no
       * other, and its suite pins the agent face as an exact set.
       */
      approve: {
        input: Schema.Struct({
          /** The plugin's word — the row's own, walked out of the `plugins`
           *  cell. */
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
       * ASK OLAI TO LOOK AT A PLUGIN THIS VAULT DEFINES — the agent's half of
       * phase 12, and the only thing on this face that touches a fiber.
       *
       * It MOUNTS NOTHING BY ITSELF. What it does is read the definition as it
       * stands and answer what became of it, which for a plugin nobody has
       * approved is `pending` — the state the panel is drawing a person a
       * question in. So the loop an agent has is: write the two halves with the
       * ordinary write tools, call this, and be told either that it is running
       * or that a person has not decided yet.
       *
       * A REFUSAL IS ONE THING: no such definition. Everything else — a half
       * that will not compile, a name already taken, an `apply` that threw — is
       * a STATE with a sentence on it, because those are answers about a plugin
       * rather than failures of this call, and an agent that got an error back
       * would have to parse prose to find out which.
       */
      run: {
        input: Schema.Struct({
          /** The word the node's `plugin` property carries. */
          name: Schema.String,
        }),
        output: Schema.Struct({
          name: Schema.String,
          /** The content hash of the two halves as they stand. */
          version: Schema.String,
          /** One of `@olai/surface`'s plugin states — `pending` until somebody
           *  approves this version. */
          state: Schema.String,
          /** Whether this version is approved. */
          approved: Schema.Boolean,
          /** Why it is not running, in a whole sentence, where there is one. */
          fault: Schema.optionalKey(Schema.String),
        }),
        error: OpFailure,
      },
/**
       * ...AND STOP ONE, for as long as this serve runs.
       *
       * NARROWED TO PLUGINS THE VAULT DEFINES, and the narrowing is the whole
       * reason this is not `plugins.set` on another face: an agent that could
       * turn a row off could turn off the row that seats it, the row that
       * watches its writes, or the row whose tools it is holding — and then not
       * be able to turn any of them back on, because the face it was calling
       * through went with them (`./faces.ts` argues it where the switch is).
       * A definition is different in the one way that matters: it is code the
       * agent wrote, in a vault the agent can write, and retracting it is
       * deleting the node.
       *
       * A restart comes back to what the vault says, exactly like the panel's
       * switch: nothing here writes.
       */
      stop: {
        input: Schema.Struct({ name: Schema.String }),
        output: Schema.Struct({}),
        error: OpFailure,
      },
/**
       * WHAT A PLUGIN MAY NAME — the registry read before the code is written.
       *
       * dsh's `cordis_inspect`, and the same argument: an agent writing a plugin
       * against a runtime it cannot see writes against a memory of one. What
       * this answers is every list that decides whether a half will mount at all
       * — the modules olai binds, the services a `needs` may name, the slots a
       * face may hang in, the words already taken — and each of them is READ
       * from the thing that enforces it rather than described beside it.
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
          /** The node layout a definition takes: the two properties and the two
           *  child titles. */
          layout: Schema.Struct({
            property: Schema.String,
            approved: Schema.String,
            server: Schema.String,
            browser: Schema.String,
          }),
          /** Every word this serve already has — built rows and vault
           *  definitions alike, because a definition may take neither. */
          taken: Schema.Array(Schema.String),
        }),
        error: OpFailure,
      } }
}
})

export const faces = { browser: { "plugins.approve": "tool" }, agent: { "plugins.inspect": "tool", "plugins.run": "tool", "plugins.stop": "tool" } } as const
