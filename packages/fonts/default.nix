# The faces the client serves from /fonts/*.woff2 — CONVERTED HERE.
#
# woff2_compress runs in this derivation, not in the client build, and the
# directory it outputs holds .woff2 and nothing else. That is the whole point:
# the conversion is a function of the font set, so it belongs where a function
# of its inputs is computed once and cached forever. It used to run in
# `../web/src/build.ts`, which meant 70 identical compressions on every
# `just build-client`, every `nix build`, every dev-shell rebuild — half a
# minute of CPU and a fresh /tmp directory each time, to produce bytes that
# were the same bytes every time.
#
# WHICH faces is not spelled here. `src/hosted.json` is the one list, read by
# this file and by `src/hosted.ts` beside it: a hosted face is where its bytes
# come from AND what CSS identity they carry, and keeping those in two
# languages meant two lists joined on a basename by a test. This reads the
# `pkg`/`dir` half and ignores the rest; the sheet generator reads the other
# half and ignores this one. Generics (System, Sans-serif, …) download nothing
# and are not there. One directory so `OLAI_FONTS_DIR` stays one variable in
# shell.nix and the root default.nix.
{ pkgs }:
let
  inherit (pkgs) lib;

  sources = builtins.fromJSON (builtins.readFile ./src/hosted.json);

  # `pkg` is an attribute PATH so a nested set can be named the way the
  # package set nests it (`ibm-plex.mono`). An unknown one fails eval here, by name.
  packageAt = path: lib.getAttrFromPath (lib.splitString "." path) pkgs;

  filesOf = source:
    map (face: "${packageAt source.pkg}/share/fonts/${source.dir}/${face.file}")
      source.faces;
in
pkgs.runCommand "olai-fonts"
{
  nativeBuildInputs = [ pkgs.woff2 ];

  # The sources, as one whitespace-separated list the builder loops over. A
  # list attribute reaches the environment that way, and every entry is a
  # store path with no space in it.
  faces = lib.concatMap filesOf sources;

  meta.description = "olai's hosted typefaces, as woff2";
} ''
  mkdir -p $out
  # woff2_compress writes its output BESIDE its input and cannot be told
  # otherwise, and its input here is a read-only store path — so each face is
  # copied into the build directory first, converted there, and only the
  # .woff2 moves to $out. The TTF/OTF is a build intermediate, never product:
  # the generated sheet names woff2 and there is no fallback path.
  for face in $faces; do
    base=''${face##*/}
    cp "$face" "$base"
    chmod +w "$base"
    woff2_compress "$base"
    mv "''${base%.*}.woff2" $out/
  done
''
