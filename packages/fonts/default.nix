# The faces the client serves from /fonts/*.woff2 — CONVERTED HERE.
#
# woff2_compress runs in this derivation, not in the client build, and the
# directory it outputs holds .woff2 and nothing else. That is the whole point:
# the conversion is a function of the font set, so it belongs where a function
# of its inputs is computed once and cached forever. It used to run in
# `../web/src/build.ts`, which meant ~40 identical compressions on every
# `just build-client`, every `nix build`, every dev-shell rebuild — half a
# minute of CPU and a fresh /tmp directory each time, to produce bytes that
# were the same bytes every time.
#
# The catalog is `src/catalog.ts`, in this same package: every file named there
# has to land in this directory under the same basename with `.woff2` for an
# extension, because the build copies them out BY NAME (`../web/src/build.ts`)
# and the generated sheet asks for them by that name (`src/css.ts`). A face in
# the catalog that is not converted here fails the build loudly rather than
# 404ing in someone's browser. Generics (System, Sans-serif, …) download
# nothing and are not here. One directory so `OLAI_FONTS_DIR` stays one
# variable in shell.nix and the root default.nix.
{ pkgs }:
let
  inherit (pkgs)
    atkinson-hyperlegible-next
    commit-mono
    crimson-pro
    et-book
    fira-code
    geist-font
    ia-writer-mono
    ia-writer-quattro
    inter
    jetbrains-mono
    junicode
    lexend
    literata
    open-dyslexic
    open-sans
    source-sans
    source-serif
    vollkorn
    ;
  ttf = pkg: file: "${pkg}/share/fonts/truetype/${file}";
  otf = pkg: file: "${pkg}/share/fonts/opentype/${file}";
in
pkgs.runCommand "olai-fonts"
{
  nativeBuildInputs = [ pkgs.woff2 ];

  # The sources, as one whitespace-separated list the builder loops over. A
  # list attribute reaches the environment that way, and every entry is a
  # store path with no space in it.
  faces = [
    (ttf literata "Literata-Regular.ttf")
    (ttf literata "Literata-Italic.ttf")
    (ttf literata "Literata-Bold.ttf")
    (ttf literata "Literata-BoldItalic.ttf")

    (ttf ia-writer-quattro "iAWriterQuattroS-Regular.ttf")
    (ttf ia-writer-quattro "iAWriterQuattroS-Italic.ttf")
    (ttf ia-writer-quattro "iAWriterQuattroS-Bold.ttf")
    (ttf ia-writer-quattro "iAWriterQuattroS-BoldItalic.ttf")

    (ttf ia-writer-mono "iAWriterMonoV.ttf")
    (ttf ia-writer-mono "iAWriterMonoV-Italic.ttf")

    (ttf source-sans "SourceSans3-Regular.ttf")
    (ttf source-sans "SourceSans3-It.ttf")
    (ttf source-sans "SourceSans3-Bold.ttf")
    (ttf source-sans "SourceSans3-BoldIt.ttf")

    (ttf source-serif "SourceSerif4-Regular.ttf")
    (ttf source-serif "SourceSerif4-It.ttf")
    (ttf source-serif "SourceSerif4-Bold.ttf")
    (ttf source-serif "SourceSerif4-BoldIt.ttf")

    (ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-Regular.ttf")
    (ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-Italic.ttf")
    (ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-Bold.ttf")
    (ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-BoldItalic.ttf")

    (ttf et-book "et-book-roman-old-style-figures.ttf")
    (ttf et-book "et-book-display-italic-old-style-figures.ttf")
    (ttf et-book "et-book-bold-line-figures.ttf")

    (ttf fira-code "FiraCode-VF.ttf")

    (ttf geist-font "GeistMono-Regular.ttf")
    (ttf geist-font "GeistMono-Italic.ttf")
    (ttf geist-font "GeistMono-Bold.ttf")
    (ttf geist-font "GeistMono-BoldItalic.ttf")

    (ttf pkgs.ibm-plex.mono "IBMPlexMono-Regular.ttf")
    (ttf pkgs.ibm-plex.mono "IBMPlexMono-Italic.ttf")
    (ttf pkgs.ibm-plex.mono "IBMPlexMono-Bold.ttf")
    (ttf pkgs.ibm-plex.mono "IBMPlexMono-BoldItalic.ttf")
    (ttf pkgs.ibm-plex.sans "IBMPlexSans-Regular.ttf")
    (ttf pkgs.ibm-plex.sans "IBMPlexSans-Italic.ttf")
    (ttf pkgs.ibm-plex.sans "IBMPlexSans-Bold.ttf")
    (ttf pkgs.ibm-plex.sans "IBMPlexSans-BoldItalic.ttf")

    (ttf inter "InterVariable.ttf")
    (ttf inter "InterVariable-Italic.ttf")

    (ttf jetbrains-mono "JetBrainsMono-Regular.ttf")
    (ttf jetbrains-mono "JetBrainsMono-Italic.ttf")
    (ttf jetbrains-mono "JetBrainsMono-Bold.ttf")
    (ttf jetbrains-mono "JetBrainsMono-BoldItalic.ttf")

    (ttf junicode "Junicode-Regular.ttf")
    (ttf junicode "Junicode-Italic.ttf")
    (ttf junicode "Junicode-Bold.ttf")
    (ttf junicode "Junicode-BoldItalic.ttf")

    "${lexend}/share/fonts/truetype/lexend/lexend/Lexend-Regular.ttf"
    "${lexend}/share/fonts/truetype/lexend/lexend/Lexend-Bold.ttf"

    (otf open-dyslexic "OpenDyslexic-Regular.otf")
    (otf open-dyslexic "OpenDyslexic-Italic.otf")
    (otf open-dyslexic "OpenDyslexic-Bold.otf")
    (otf open-dyslexic "OpenDyslexic-Bold-Italic.otf")

    (ttf open-sans "OpenSans-Regular.ttf")
    (ttf open-sans "OpenSans-Italic.ttf")
    (ttf open-sans "OpenSans-Bold.ttf")
    (ttf open-sans "OpenSans-BoldItalic.ttf")

    (ttf crimson-pro "CrimsonPro-Regular.ttf")
    (ttf crimson-pro "CrimsonPro-Italic.ttf")
    (ttf crimson-pro "CrimsonPro-Bold.ttf")
    (ttf crimson-pro "CrimsonPro-BoldItalic.ttf")

    (ttf vollkorn "Vollkorn-Regular.ttf")
    (ttf vollkorn "Vollkorn-Italic.ttf")
    (ttf vollkorn "Vollkorn-Bold.ttf")
    (ttf vollkorn "Vollkorn-BoldItalic.ttf")

    (ttf commit-mono "CommitMono-400-Regular.ttf")
    (ttf commit-mono "CommitMono-400-Italic.ttf")
    (ttf commit-mono "CommitMono-700-Regular.ttf")
    (ttf commit-mono "CommitMono-700-Italic.ttf")
  ];

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
