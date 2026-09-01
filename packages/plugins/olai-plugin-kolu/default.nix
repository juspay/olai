# KOLU'S OWN MARK, out of the npins kolu pin and into a TypeScript module —
# this package's third product, and the only one that is not a JavaScript door.
#
# The face over a sentence kolu delivered into somebody's conversation is
# kolu's LOGO, `packages/client/favicon.svg` in juspay/kolu, and it must be the
# real one. Three ways of getting it here were weighed and two were refused:
# a copy committed into this tree (a second original, stale the day kolu redraws
# its mark), and a fetch from the running page (a transcript that sometimes has
# no mark, which is worse than one that never does). What is left is the pin —
# the same `npins/sources.json` revision every `@kolu/*` source comes from — so
# BUMPING THE PIN IS THE WHOLE OF UPDATING THE LOGO.
#
# This goes STRAIGHT to the pin rather than through `../../../nix/kolu.nix`, and
# that is a boundary rather than a shortcut: that file's job is the vendored
# TypeScript closure — seeds, members, the hydrate argv — and a favicon is
# neither a seed nor a package. It is one file at a known path in the same
# source, so it is read as one.
#
# The transform is NOT written here. `src/mark/inline.ts` is a pure function
# with its own bench, and `src/mark/emit.ts` is the six lines of argv around it;
# this derivation runs them with the pinned bun. A `sed` over XML in the shell
# below would emit something for every input, and the something would be a
# half-painted logo nothing could have tested — the same argument
# `../../fonts/default.nix` makes for converting faces once, made about
# correctness instead of about cost.
#
# The output is a DIRECTORY holding one file, for `../../fonts/default.nix`'s own
# reason: `OLAI_KOLU_MARK_DIR` stays one variable if kolu ever ships a second
# asset (a small variant drawn to read at fourteen pixels is the one already
# imagined).
{ pkgs }:
let
  npins = import ../../../npins;

  svg = "${npins.kolu}/packages/client/favicon.svg";

  # EXACTLY the two generator files, not `./src`. Anything wider would re-realise
  # this derivation on every unrelated edit to the plugin — and would put the
  # generated module's own directory in its input, which is a loop waiting for
  # somebody to widen the fileset once more.
  gen = pkgs.lib.fileset.toSource {
    root = ./src/mark;
    fileset = pkgs.lib.fileset.unions [
      ./src/mark/inline.ts
      ./src/mark/emit.ts
    ];
  };
in
pkgs.runCommand "olai-plugin-kolu-mark"
{
  nativeBuildInputs = [ pkgs.bun ];

  inherit svg;
  revision = npins.kolu.revision;

  meta.description = "kolu's own mark, from the npins kolu pin, as a TypeScript module";
} ''
  # bun wants a home directory, and the sandbox does not give it one.
  export HOME=$TMPDIR

  # THE FIRST AND MOST VALUABLE OF THE FOUR FAILURES: the pin moved the file.
  # The logo cannot silently stop existing, which is the whole of what "the pin
  # keeps it honest" means.
  test -f "$svg" || {
    echo "kolu's mark is not at $svg — it comes from the npins kolu pin (npins/sources.json); update packages/plugins/olai-plugin-kolu/default.nix if kolu moved packages/client/favicon.svg" >&2
    exit 1
  }

  mkdir -p $out
  bun ${gen}/emit.ts "$svg" "$revision" > $out/mark.generated.ts
''
