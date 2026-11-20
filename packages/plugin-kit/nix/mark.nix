{ pkgs }:
{ svg, revision, from }:
let
  gen = pkgs.lib.fileset.toSource {
    root = ../src/mark;
    fileset = pkgs.lib.fileset.unions [
      ../src/mark/inline.ts
      ../src/mark/emit.ts
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
