# The vendored TypeScript source olai consumes from odu — ONE package, and it
# is deliberately not a closure walk.
#
# `nix/kolu.nix` next door asks kolu's own `consumer.nix` to expand a seed list
# into thirty-two members, because kolu IS olai's framework: the surface, the
# Dock row, the terminal vocabulary, six packages deep. odu is not that. What
# olai wants from odu is the half of it a CLIENT of a live run holds
# (`@odu/run-client` — juspay/odu#94), whose whole declared closure is
# `effect`, and whose `@kolu/surface` import resolves against the sources kolu
# already hydrated one file over. One directory, copied; no expansion to ask
# for, and nothing for a seed list to compute.
#
# THE PIN TRACKS MASTER, exactly as the kolu pin beside it does, and that is
# the second state this pin has been in rather than its first. `@odu/run-client`
# shipped in juspay/odu#94 as a DRAFT, so the pin began FROZEN at an exact sha
# (the human's ruling, 2026-08-29: exact sha, re-pin at fold — reproducible at
# every point) precisely because a draft's branch head moves under a merge that
# has not happened yet. #94 merged (squash, `b1c3e70f`), the reason expired
# with it, and the pin became an ordinary tracking one: `just update-pins`
# walks it forward with everything else, and `npins/sources.json` records the
# revision either way, so what this tree compiled against is always in the diff.
#
# WHY THE SCRIPT IS KOLU'S. The copier is generic — `<src> <dest>` pairs, `cp
# -rL` so a hydrated source's own imports resolve up into the root
# node_modules — and it lives in kolu because that is the repo whose layout it
# knows (its own header argues the one-copy rule). Asking odu for a second one,
# or writing a third here, would be exactly the drift that header describes.
# So this file supplies ARGV and nothing else.

{ pkgs }:

let
  npins = import ../npins;
in
{
  # The one (src, dest) pair, in the shape `hydrate-kolu-packages.sh` takes.
  # `@odu/run-client` rather than a slug of odu's own: the name in the manifest
  # is the name an import writes, and a consumer inventing its own would be one
  # more thing to keep in step.
  hydrateArgs = "${npins.odu}/packages/run-client @odu/run-client";

  # The pinned package's own manifest, for `scripts/check-odu-deps.sh` — it
  # asserts olai's root against what odu DECLARES rather than against a second
  # copy of the list, which is the difference between a version constraint that
  # is checked and one that is hoped. Read out of the store path so the answer
  # is the pin's, not a transcription of it.
  externals = builtins.fromJSON
    (builtins.readFile "${npins.odu}/packages/run-client/package.json");

  # The revision this tree consumes, so a report can name it without anybody
  # reading JSON. Same fact `npins/sources.json` holds; exposed because the
  # PR body and the manifest note both want to quote it.
  revision = npins.odu.revision;
}
