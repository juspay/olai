# @olai/cordis-spike

Throwaway evidence for the Cordis-for-olai spike. Not a shipping package.

Cordis core + loader are **pinned with npins** (`npins/sources.json`, name
`cordis`) and hydrated as TypeScript by `just install`, the same route as
`@odu/run-client`. There is no `vendor/` copy.

The spike mounts a server-door half as a fiber with
`inject = ['vault','deliveries','kinds','surfaces']`, and re-composes
`ctx.surfaces` on register/dispose. The proofs live in `src/*.test.ts`.
The answers live in the draft PR body.

The lane's checkout is `.worktrees/cordis-spike`. It is gitignored
(`/.worktrees`) and is not in the tree. `git worktree remove` it when
this draft is closed; nothing here ships.
