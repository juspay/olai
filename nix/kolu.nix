# The vendored TypeScript sources olai consumes — SIX SEED NAMES, and kolu
# computes the rest.
#
# This file used to carry the whole closure: a hand-written 32-entry `members`
# list, an `attrOf` slug rule with five exceptions written out because a rule
# with five exceptions is a rule nobody can read, an overlay built from it, the
# hydrate argv, the source-dir list, and the flake's `packages` output. All of
# it was correct, and all of it was a SECOND COPY of something kolu already
# computes from its own manifests — kept in step by hand, with nothing checking.
# The survey that found it measured the copy: 32 members out of 32, and 16 root
# dependencies out of 16, exact.
#
# kolu#2217 shipped `nix/consumer.nix` and `nix/consumer-closure.json`;
# kolu#2219 declared the last two seeds olai needs (`@kolu/detect` and
# `terminal-themes`) vendorable, which is what let this file finally become the
# seed list it always wanted to be. An unknown seed is a loud error rather than
# a quiet nothing, and the closure walk IS the sibling-closure check that
# `scripts/check-kolu-deps.sh` used to perform by hand.
#
# WHAT IS STILL OLAI'S, and it is exactly two things:
#
#   - the SEEDS: the packages olai's own source imports directly. Everything
#     they depend on arrives on its own. Adding an import that reaches a new
#     kolu package is still one line here — it is just no longer thirty.
#   - the GRAFT for `osfacts-client`, which is not in the kolu repository at
#     all (gitignored there, and therefore absent from the archive npins
#     fetches). kolu names it in the closure and says which pin and revision it
#     must come from; olai supplies the tree from its own `osfacts` pin and
#     kolu REFUSES AT EVAL if the two revisions disagree. That refusal is what
#     retired `scripts/check-osfacts-pin.sh`: the check moved from a shell
#     script running in one `just` leg to the moment the build graph is
#     evaluated, which is every leg.
#
# The sources are consumed as raw TypeScript — there is no build step, which is
# also why every one of them is compiled by olai's own `tsc` and why a source
# that will not typecheck here is a blocker rather than a nuisance. That is the
# whole reason this arrangement is worth its cost, and it is unchanged.
#
# NOTE THE ATTR RENAME. Members are `kolu-surface`, not `kolu-src-surface`:
# the slug is kolu's now, and a consumer inventing its own would be one more
# thing to keep in step.

{ pkgs }:

let
  npins = import ../npins;

  consumer = import "${npins.kolu}/nix/consumer.nix" {
    inherit pkgs;
    src = npins.kolu;

    # THE SEEDS — what olai's own source imports by name. Read the two tiers
    # rather than the list: `@kolu/surface*` is the FRAMEWORK olai's app is
    # built on (imported anywhere, like `effect`), and the rest is the padi
    # INTEGRATION. `@kolu/padi-client` and `@kolu/terminal-vocab` are not here
    # because they are not seeds — they arrive through `@kolu/detect`'s and the
    # dock row's own closures, which is the point of a closure.
    seeds = [
      "@kolu/detect"
      "@kolu/solid-dockrow"
      "@kolu/surface-app"
      "@kolu/surface-cli"
      "@kolu/surface-mcp"
      "terminal-themes"
    ];

    # The second pin, grafted. `revision` is not decoration: kolu compares it
    # against the revision its own closure records and throws if they differ,
    # naming both — so the two repositories cannot drift apart silently, which
    # is precisely what the retired shell check was watching for.
    pinnedSources."osfacts-client" = {
      src = "${npins.osfacts}/client-ts";
      revision = npins.osfacts.revision;
    };
  };
in
consumer // {
  # The hydrated sources as bare directories, for `scripts/check-kolu-deps.sh`.
  # `consumer.nix` has no `sourceDirs` of its own — it exports `packages`, and
  # this is that, spelled the way one shell script wants to read it.
  sourceDirs = builtins.concatStringsSep " "
    (map toString (builtins.attrValues consumer.packages));
}
