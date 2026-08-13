# The faces the client serves from /fonts/*.woff2.
#
# Source Sans 3 is the chrome (header, sidebar, notes, chat). Source Serif 4
# is the page (outline titles, a document). Both come from nixpkgs; the client
# build converts these TTFs to woff2. One directory so `OLAI_FONTS_DIR` stays
# one variable in shell.nix and default.nix.
{ pkgs }:
pkgs.runCommand "olai-fonts" { } ''
  mkdir -p $out
  cp ${pkgs.source-sans}/share/fonts/truetype/SourceSans3-Regular.ttf $out/
  cp ${pkgs.source-sans}/share/fonts/truetype/SourceSans3-It.ttf $out/
  cp ${pkgs.source-sans}/share/fonts/truetype/SourceSans3-Semibold.ttf $out/
  cp ${pkgs.source-sans}/share/fonts/truetype/SourceSans3-Bold.ttf $out/
  cp ${pkgs.source-serif}/share/fonts/truetype/SourceSerif4-Regular.ttf $out/
  cp ${pkgs.source-serif}/share/fonts/truetype/SourceSerif4-It.ttf $out/
  cp ${pkgs.source-serif}/share/fonts/truetype/SourceSerif4-Semibold.ttf $out/
  cp ${pkgs.source-serif}/share/fonts/truetype/SourceSerif4-Bold.ttf $out/
''
