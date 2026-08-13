# The faces the client serves from /fonts/*.woff2.
#
# The catalog is packages/web/src/client/theme/fonts.ts: every file named
# there has to land in this directory under the same basename, because the
# client build converts these TTFs/OTFs to woff2 and the sheet looks them up
# by that name. Generics (System, Sans-serif, …) download nothing and are
# not here. One directory so `OLAI_FONTS_DIR` stays one variable in shell.nix
# and default.nix.
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
    ibm-plex
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
pkgs.runCommand "olai-fonts" { } ''
  mkdir -p $out

  cp ${ttf literata "Literata-Regular.ttf"} $out/
  cp ${ttf literata "Literata-Italic.ttf"} $out/
  cp ${ttf literata "Literata-Bold.ttf"} $out/
  cp ${ttf literata "Literata-BoldItalic.ttf"} $out/

  cp ${ttf ia-writer-quattro "iAWriterQuattroS-Regular.ttf"} $out/
  cp ${ttf ia-writer-quattro "iAWriterQuattroS-Italic.ttf"} $out/
  cp ${ttf ia-writer-quattro "iAWriterQuattroS-Bold.ttf"} $out/
  cp ${ttf ia-writer-quattro "iAWriterQuattroS-BoldItalic.ttf"} $out/

  cp ${ttf ia-writer-mono "iAWriterMonoV.ttf"} $out/
  cp ${ttf ia-writer-mono "iAWriterMonoV-Italic.ttf"} $out/

  cp ${ttf source-sans "SourceSans3-Regular.ttf"} $out/
  cp ${ttf source-sans "SourceSans3-It.ttf"} $out/
  cp ${ttf source-sans "SourceSans3-Bold.ttf"} $out/
  cp ${ttf source-sans "SourceSans3-BoldIt.ttf"} $out/

  cp ${ttf source-serif "SourceSerif4-Regular.ttf"} $out/
  cp ${ttf source-serif "SourceSerif4-It.ttf"} $out/
  cp ${ttf source-serif "SourceSerif4-Bold.ttf"} $out/
  cp ${ttf source-serif "SourceSerif4-BoldIt.ttf"} $out/

  cp ${ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-Regular.ttf"} $out/
  cp ${ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-Italic.ttf"} $out/
  cp ${ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-Bold.ttf"} $out/
  cp ${ttf atkinson-hyperlegible-next "AtkinsonHyperlegibleNext-BoldItalic.ttf"} $out/

  cp ${ttf et-book "et-book-roman-old-style-figures.ttf"} $out/
  cp ${ttf et-book "et-book-display-italic-old-style-figures.ttf"} $out/
  cp ${ttf et-book "et-book-bold-line-figures.ttf"} $out/

  cp ${ttf fira-code "FiraCode-VF.ttf"} $out/

  cp ${ttf geist-font "GeistMono-Regular.ttf"} $out/
  cp ${ttf geist-font "GeistMono-Italic.ttf"} $out/
  cp ${ttf geist-font "GeistMono-Bold.ttf"} $out/
  cp ${ttf geist-font "GeistMono-BoldItalic.ttf"} $out/

  cp ${ttf ibm-plex "IBMPlexMono-Regular.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexMono-Italic.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexMono-Bold.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexMono-BoldItalic.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexSans-Regular.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexSans-Italic.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexSans-Bold.ttf"} $out/
  cp ${ttf ibm-plex "IBMPlexSans-BoldItalic.ttf"} $out/

  cp ${ttf inter "InterVariable.ttf"} $out/
  cp ${ttf inter "InterVariable-Italic.ttf"} $out/

  cp ${ttf jetbrains-mono "JetBrainsMono-Regular.ttf"} $out/
  cp ${ttf jetbrains-mono "JetBrainsMono-Italic.ttf"} $out/
  cp ${ttf jetbrains-mono "JetBrainsMono-Bold.ttf"} $out/
  cp ${ttf jetbrains-mono "JetBrainsMono-BoldItalic.ttf"} $out/

  cp ${ttf junicode "Junicode-Regular.ttf"} $out/
  cp ${ttf junicode "Junicode-Italic.ttf"} $out/
  cp ${ttf junicode "Junicode-Bold.ttf"} $out/
  cp ${ttf junicode "Junicode-BoldItalic.ttf"} $out/

  cp ${lexend}/share/fonts/truetype/lexend/lexend/Lexend-Regular.ttf $out/
  cp ${lexend}/share/fonts/truetype/lexend/lexend/Lexend-Bold.ttf $out/

  cp ${otf open-dyslexic "OpenDyslexic-Regular.otf"} $out/
  cp ${otf open-dyslexic "OpenDyslexic-Italic.otf"} $out/
  cp ${otf open-dyslexic "OpenDyslexic-Bold.otf"} $out/
  cp ${otf open-dyslexic "OpenDyslexic-Bold-Italic.otf"} $out/

  cp ${ttf open-sans "OpenSans-Regular.ttf"} $out/
  cp ${ttf open-sans "OpenSans-Italic.ttf"} $out/
  cp ${ttf open-sans "OpenSans-Bold.ttf"} $out/
  cp ${ttf open-sans "OpenSans-BoldItalic.ttf"} $out/

  cp ${ttf crimson-pro "CrimsonPro-Regular.ttf"} $out/
  cp ${ttf crimson-pro "CrimsonPro-Italic.ttf"} $out/
  cp ${ttf crimson-pro "CrimsonPro-Bold.ttf"} $out/
  cp ${ttf crimson-pro "CrimsonPro-BoldItalic.ttf"} $out/

  cp ${ttf vollkorn "Vollkorn-Regular.ttf"} $out/
  cp ${ttf vollkorn "Vollkorn-Italic.ttf"} $out/
  cp ${ttf vollkorn "Vollkorn-Bold.ttf"} $out/
  cp ${ttf vollkorn "Vollkorn-BoldItalic.ttf"} $out/

  cp ${ttf commit-mono "CommitMono-400-Regular.ttf"} $out/
  cp ${ttf commit-mono "CommitMono-400-Italic.ttf"} $out/
  cp ${ttf commit-mono "CommitMono-700-Regular.ttf"} $out/
  cp ${ttf commit-mono "CommitMono-700-Italic.ttf"} $out/
''
