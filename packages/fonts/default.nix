{ pkgs }:
let
  inherit (pkgs) lib;

  sources = builtins.fromJSON (builtins.readFile ./src/hosted.json);

  packageAt = path: lib.getAttrFromPath (lib.splitString "." path) pkgs;

  filesOf = source:
    map (face: "${packageAt source.pkg}/share/fonts/${source.dir}/${face.file}")
      source.faces;
in
pkgs.runCommand "olai-fonts"
{
  nativeBuildInputs = [ pkgs.woff2 ];

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
