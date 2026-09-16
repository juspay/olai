/**
 * THE SHAPE AN ENGINE'S `e2e/fake` DESCRIPTOR ANSWERS — the one contract the
 * harness holds an engine to, and the whole of what it may know or say about
 * one (section 13.3).
 *
 * This type lives in the bundle, not the harness: the bundle GENERATES
 * `fakes.generated.ts` (the roster every consumer loads through
 * `@olai/bundle/e2e-fakes`), so the type of what it emits must be its own.
 * The harness re-exports it through `@olai/tests/harness/fake.ts` so each
 * engine's `e2e/fake/index.ts` imports from one place.
 *
 * Every engine plugin that carries a scripted fake exports it behind its own
 * `./e2e/fake` door, and this file is what that door's descriptor is typed as.
 * The two sides meet only through this interface: the harness folds the
 * descriptors `@olai/bundle/e2e-fakes` hands it (over the plugin's package
 * name and nothing else), and an engine's fake answers with its word, its
 * adapter knob and executable, and the four optional contributions a scenario
 * can ask a machine to have. Nothing here names an engine, a knob or a
 * directory — which is the fence's claim about `packages/tests/support/**`.
 */

/** A directory or executable a fake owns, named by the code that owns it.
 *  Reaching the harness through this interface keeps the two from spelling
 *  each other's paths. */
export interface Fake {
  /** The plugin's word — `@<word>` is its tag, and the roster's id. */
  readonly word: string;
  /** The adapter half of an engine with a pinned ACP executable: the knob the
   *  packaged wrapper bakes its default into, and the executable to point it
   *  at when a scenario asks. `""` is that row's off switch, exactly the way
   *  the wrapper's own empty default is. */
  readonly adapter?: { readonly knob: string; readonly exe: string };
  /** A directory for `OLAI_AGENT_PATH` when a scenario asks for this engine
   *  (`@<word>`): what a probe on the host would find this engine at. */
  readonly searchPath?: string;
  /** A directory put FIRST on every spawned server's PATH, whatever the
   *  scenario asked — the machine this engine is on is on the box. */
  readonly path?: string;
  /** Anything else a scenario's asking turns on or off. `on` is whether this
   *  engine's word was asked (or it is the default agent), `stored` whether
   *  `@agent-stored` was. The `stored` flags an engine reads live here. */
  readonly env?: (asked: {
    readonly on: boolean;
    readonly stored: boolean;
  }) => Readonly<Record<string, string>>;
}
