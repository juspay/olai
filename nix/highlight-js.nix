# highlight.js, staged as the files the web view serves.
#
# Same discipline as the browser runtime under live/static/ (live/default.nix):
# a vendored artifact is a PIN and a hash in npins/sources.json, never a
# minified blob in the diff. `npins update highlight-js` is the upgrade, and
# what it upgrades is visible as a revision.
#
# The pin is highlightjs/cdn-release rather than the highlight.js source repo:
# upstream builds the bundle there, tag by tag, so there is nothing to build
# here — only to choose. The choice is the table below.
{ lib, stdenvNoCC, sources }:

let
  # Which files, out of the checkout. They keep their own names, and those
  # names are `highlight-scripts` in olai/web/markdown.rkt — that list and this
  # one are the two halves of one fact, and olai/tests/render.rkt fails if they
  # disagree.
  #
  # The bundle carries the COMMON languages (bash, json, js, sql, …). The two
  # beside it are the ones an olai outline is actually written in and the
  # common set leaves out; each language is its own file, so this is the whole
  # cost of having them.
  assets = [
    "build/highlight.min.js"
    # racket / rkt ride on this one — highlight.js has no Racket grammar, and
    # the alias is registered in static/highlight-init.js
    "build/languages/scheme.min.js"
    "build/languages/nix.min.js"
  ];
in
stdenvNoCC.mkDerivation {
  pname = "highlight-js";
  version = sources.highlight-js.version;

  src = sources.highlight-js;

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall

    # …and upstream's licence beside them, because that is what shipping
    # somebody else's bytes asks of us.
    install -m 0444 -Dt $out \
      ${lib.concatMapStringsSep " " (p: ''"$src/${p}"'') assets} \
      "$src/LICENSE"

    runHook postInstall
  '';

  meta = with lib; {
    description = "highlight.js browser bundle, as olai serves it";
    license = licenses.bsd3;
  };
}
