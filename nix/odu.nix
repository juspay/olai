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

# WHAT THIS FILE ALSO VENDORS, since the ruling of 2026-09-01: THE BINARY.
# Sources alone were the missing half — a packaged olai resolved `odu` off an
# ambient PATH that a deployed serve (a systemd unit, `nix run`) does not
# have, and the odu plugin's probe found nothing there. So the pin's own
# default.nix is composed below: odu built the way ODU builds it — its own
# pinned nixpkgs and overlay (the @kolu/* source copies its build hydrates),
# its own bun.nix — with THIS tree's bun2nix standing in for odu's own
# bun2nix input: the two spell `fetchBunDeps` + `hook` the same way, and a
# second toolchain pin for one derivation would be one more thing to keep in
# step. The result is the wrapper with the runner flake and the agent binary
# cache baked on, because a conversation's `run` verb provisions lanes and a
# coordinator without them is misbuilt — `selfFlake` is the pin itself, the
# same source odu's own flake would have been built from.
#
# `b2n` is OPTIONAL for the dev shell's sake: shell.nix imports this file for
# `hydrateArgs` and `externals` and carries no bun2nix of its own. Nothing
# lazy forces `bin` there; force it without a b2n and odu's own `base` names
# what is missing.

{ pkgs, b2n ? null }:

let
  npins = import ../npins;
in
{
  # The one (src, dest) pair, in the shape `hydrate-kolu-packages.sh` takes.
  # `@odu/run-client` rather than a slug of odu's own: the name in the manifest
  # is the name an import writes, and a consumer inventing its own would be one
  # more thing to keep in step.
  hydrateArgs = "${npins.odu}/packages/run-client @odu/run-client";

  # The pinned package's own manifest, for `scripts/check-hydrated-deps.sh` — it
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

  # THE BINARY — odu's own `odu` wrapper, built from the pin. Composed rather
  # than re-described: `${npins.odu}/default.nix` is the recipe odu's flake
  # runs, and an olai-side re-spelling of the makeWrapper arguments would be
  # exactly the drift `hydrateArgs` above rides kolu's one script to avoid.
  # The pkgs is odu's OWN pinned one — olai's cannot be substituted: the
  # build hydrates @kolu/* sources from the overlay odu's nixpkgs import
  # applies, and the revisions those resolve to are the pin's business, not
  # this tree's.
  bin = (import "${npins.odu}/default.nix" {
    pkgs = import "${npins.odu}/nix/nixpkgs.nix" {
      inherit (pkgs.stdenv.hostPlatform) system;
    };
    inherit b2n;
    selfFlake = "${npins.odu}";
  }).odu;
}
