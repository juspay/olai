# `packages/plugins/` — the plugin container

**Not a package.** There is no `package.json` here and there must not be: this
directory holds plugins and nothing else, and a manifest at this path would put
a workspace member at `packages/plugins`, which is the name the appliance fold
moved the interface OUT of.

What goes in it: one directory per plugin, named the plugin word, and the
package inside is called `olai-plugin-<name>` — unscoped. `@olai/*` is the scope
for the packages that ARE olai; a plugin is olai's judgement about somebody
else's software, which is the closest thing in this tree to a plugin written
outside it, so it is named the way one would be.

The population today is SIX, in two kinds, and nothing in the system tells them
apart — same shape, same doors, same five states in the preferences panel, same
`--plugins` word:

- **TENANTS** — olai's judgement about an appliance: `kolu`, `odu`,
  `xyne-spaces`. Each composes a sibling surface and draws faces on rows.
- **ENGINES** — an ACP agent the chat panel can seat: `claude`, `opencode`,
  `pi`. Each hands over a `Leg` (how to read that agent's wire), a probe that
  finds it on this host, the whole sentence for a machine that has not installed
  it, and the channel its standing prompt rides. It composes NO surface: what it
  contributes to a tab already travels on the chat cell, which is core's. One
  directory each because they share no release clock — the Claude adapter's pin
  moved five times in a month and opencode's has never moved — and because
  `--plugins` then enables them one at a time.

What does NOT go in it: the interface those tenants are written against. That is
[`@olai/plugin-api`](../plugin-api/README.md), one directory over, with the registry that lists them in [`@olai/bundle`](../bundle/README.md) beside it, and the
separation is the point — `@olai/bundle` is the one package a plugin may not
import, so a directory holding the fence.s subject beside the things it fences
would read as a contradiction in the workspace globs and in the fence.s own
graph walk. A tenant DOES import the interface, which is what makes the arrow
one-way and the cycle unrepresentable.

Neither rule is a convention. `packages/bundle/src/fence.test.ts`'s ninth
claim holds this directory to the registry's own roster in **both** directions,
read off two independent sources — the roster, and a `readdir` of this directory
— so a plugin left outside it and a general package dropped inside it are each a
red test. `scripts/prove-fence.sh`'s mutation 13 is that claim's falsifier.

The whole checklist for adding one is
[docs/internal/plugin-system.md §9](../../docs/internal/plugin-system.md).
