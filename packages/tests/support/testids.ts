/**
 * THE COMBINED TEST IDS, as a harness name — the fifth door, and the one a
 * plugin's own steps could not open for themselves.
 *
 * `@olai/bundle/testids` is the registry's flat table of every row's ids plus
 * the boot and shared-widget ones, and its own header says why it exists: a
 * `data-testid` is a contract between packages that never import each other,
 * and the suite spends them. What its header could not have said then is that
 * the SUITE is not one package any more — a plugin keeps the steps that drive
 * its own surface, under its own `e2e/`.
 *
 * A plugin may not import the registry. That ban is `@olai/bundle`'s
 * `fence.test.ts`, it is held over the sources as well as the manifests, and it
 * is not a rule about production code: `@olai/bundle` imports every plugin, so a
 * plugin importing it back is a cycle whichever directory it is spelled in.
 *
 * So the combined table arrives the way every other cross-cutting name does —
 * through the harness, which is the package the fence records as allowed to name
 * a row. What a step should prefer is still its OWN row's table, relatively
 * (`../../src/testids.ts`): that is one package's own file, it needs no door at
 * all, and a renamed id is a type error in the package that renamed it. This is
 * for the ids that are NOBODY's row — the header, the sidebar shell, the
 * connection — and for the step that legitimately reads another row's id
 * because the thing it is asserting about is drawn by two of them.
 */

export { PLUGIN_TESTID, TESTID } from "@olai/bundle/testids";
export type { PluginTestId, TestId } from "@olai/bundle/testids";
