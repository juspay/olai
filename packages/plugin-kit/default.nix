# A TENANT'S MARK, out of that tenant's npins pin and into a TypeScript
# module — the mechanism, said once.
#
# The face over a sentence a plugin delivered into somebody's conversation
# is that appliance's OWN LOGO, and it must be the real one. Three ways of
# getting it here were weighed and two were refused: a copy committed into
# this tree (a second original, stale the day the appliance redraws its
# mark), and a fetch from the running page (a transcript that sometimes has
# no mark, which is worse than one that never does). What is left is the
# pin, so BUMPING THE PIN IS THE WHOLE OF UPDATING THE LOGO.
#
# The CALLER names the file. A favicon is neither a seed nor a package; it
# is one file at a known path in the same source the tenant already hydrates
# from, so it is read as one. Kolu's is `packages/client/favicon.svg`; odu's
# is `logo.svg` at the repo root. A third tenant names its own.
#
# The transform is NOT written here. `src/mark/inline.ts` is a pure function
# with its own bench, and `src/mark/emit.ts` is the argv around it; this
# derivation runs them with the pinned bun. A `sed` over XML in the shell
# below would emit something for every input, and the something would be a
# half-painted logo nothing could have tested.
#
# The output is a DIRECTORY holding one file, so `OLAI_*_MARK_DIR` stays one
# variable if a tenant ever ships a second asset.
{
  pkgs,
  svg,
  revision,
  from,
}:
let
  gen = pkgs.lib.fileset.toSource {
    root = ./src/mark;
    fileset = pkgs.lib.fileset.unions [
      ./src/mark/inline.ts
      ./src/mark/emit.ts
    ];
  };
in
pkgs.runCommand "olai-plugin-mark"
{
  nativeBuildInputs = [ pkgs.bun ];

  inherit svg revision from;

  meta.description = "a tenant's own mark, from its npins pin, as a TypeScript module";
} ''
  export HOME=$TMPDIR

  test -f "$svg" || {
    echo "the mark is not at $svg — it comes from $from (npins/sources.json); update the plugin's default.nix if the pin moved the file" >&2
    exit 1
  }

  mkdir -p $out
  bun ${gen}/emit.ts "$svg" "$revision" "$from" > $out/mark.generated.ts
''
