# `packages/plugins/` — the tenant container

**Not a package.** There is no `package.json` here and there must not be: this
directory holds plugins and nothing else, and a manifest at this path would put
a workspace member at `packages/plugins`, which is the name the appliance fold
moved the interface OUT of.

What goes in it: one directory per plugin, named `olai-plugin-<name>`, and the
package inside is called the same thing — unscoped. The population today is
`olai-plugin-kolu`, `olai-plugin-odu` and `olai-plugin-xyne-spaces`. `@olai/*` is the scope for
the packages that ARE olai; a tenant is olai's judgement about somebody else's
appliance, which is the closest thing in this tree to a plugin written outside
it, so it is named the way one would be.

What does NOT go in it: the interface those tenants are written against. That is
[`@olai/plugin-api`](../plugin-api/README.md), one directory over, and the
separation is the point — it is the one package a plugin may not import, so a
directory holding the fence's subject beside the things it fences would read as
a contradiction in the workspace globs and in the fence's own graph walk.

Neither rule is a convention. `packages/plugin-api/src/fence.test.ts`'s ninth
claim holds this directory to the registry's own roster in **both** directions,
read off two independent sources — the roster, and a `readdir` of this directory
— so a plugin left outside it and a general package dropped inside it are each a
red test. `scripts/prove-fence.sh`'s mutation 13 is that claim's falsifier.

The whole checklist for adding one is
[docs/internal/plugin-system.md §9](../../docs/internal/plugin-system.md).
