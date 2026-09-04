/**
 * THE BUILD'S OWN ORDER, imposed on a registry's arrival order — the sort two
 * of this plugin's readings spend, and the claim a re-rolling e2e failure was
 * named after.
 *
 * ## Why anything has to be sorted at all
 *
 * A registration happens when its plugin's `apply` runs, and a row's `apply`
 * runs when the loader's `import()` for that row comes back. Two rows, two
 * imports, and whichever resolved first went first. What that reached was a
 * conversation: the agent reported `servers: [olai odu kolu]` where the same
 * serve had reported `servers: [olai kolu odu]` the run before, and the chips
 * under the panel's header reordered with it — so a scenario asserting the whole
 * line failed on a different scenario each run, which is how an ordering race
 * reads from outside.
 *
 * Two readings in this plugin have that problem and one answer: WHAT TO ASK a
 * host when a conversation opens, and WHICH ENGINES this build seats — which is
 * also the order the picker draws its rows in and the order the install
 * sentences appear on the no-agent face.
 *
 * ## THE RANK ARRIVES AS DATA, and that is the plugin wall
 *
 * It was `@olai/bundle`'s `inBundleOrder`, read straight off `olai.yml`. The
 * registry imports every plugin, so a plugin importing the registry back is the
 * cycle the manifests decline to express — which is why the rank is a service a
 * plugin NAMES ({@link @olai/plugin-api}'s `Bundle`), the same way the kind
 * vocabulary travels. What a row may know about the list is its own position in
 * it and nothing else: there is no `rows()` here, deliberately, because the next
 * reader would key something by it.
 *
 * A STRANGER RANKS LAST rather than first, which is what an out-of-tree plugin
 * will want the day `olai plugin add` lands — and is the reason this is a rank
 * rather than an `indexOf`, whose `-1` sorts an unknown name to the front.
 *
 * STABLE, because `Array.prototype.sort` is: two rows the build ranks the same
 * (every row, in a process with no bundle behind it) come back in arrival order
 * rather than shuffled.
 */

/** Sort by where each item's plugin sits in the build's list of rows. */
export const inBundleOrder = <A>(
  items: Iterable<A>,
  keyOf: (one: A) => string,
  rank: (plugin: string) => number,
): ReadonlyArray<A> =>
  [...items].sort((one, other) => rank(keyOf(one)) - rank(keyOf(other)))
