/**
 * @olai/plugin-build — source somebody wrote, as a module olai can mount.
 *
 * ONE DOOR, because there is one graph: the Solid transform is a babel preset
 * and it is on every path through this package. A consumer that only wanted the
 * three module names would still pull it, so there is nothing to split and no
 * second door to argue for.
 *
 * What crosses is TEXT and a refusal. Nothing here knows what a vault is, what a
 * row is, who approves anything, or where a built half is evaluated — which is
 * the fence that lets the whole package be tested with two string constants and
 * no serve.
 */

export { type Built, buildHalf, type Half } from "./build.ts"
export { bind, type Bound } from "./bind.ts"
export { modulesFor, unresolvable } from "./imports.ts"
export { BROWSER_MODULES, REGISTRY, SERVER_MODULES, WRITABLE_MODULES } from "./shared.ts"
