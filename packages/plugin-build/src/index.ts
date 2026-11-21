/**
 * @olai/plugin-build — source somebody wrote, as a module olai can mount.
 *
 * THE BUILD IS ONE DOOR, because there is one graph: the Solid transform is a
 * babel preset and it is on every path through it. The module vocabulary — the
 * names a plugin may import and the registry they resolve through — is the
 * other door, `./shared`, which pulls no transform.
 *
 * What crosses is TEXT and a refusal. Nothing here knows what a vault is, what a
 * row is, who approves anything, or where a built half is evaluated — which is
 * the fence that lets the whole package be tested with two string constants and
 * no serve.
 */

export { asDataUrl, buildPlugin, type Half, type Linked, type Module } from "./build.ts"
