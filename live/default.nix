# The `live` collection, assembled: its Racket source plus the browser runtime
# it ships.
#
# Three of the four files under static/ are not ours — htmx, htmx's SSE
# extension, and idiomorph. They are npins-pinned upstream checkouts rather
# than committed blobs, so "which version is this" is a line in
# npins/sources.json with a hash beside it instead of a claim in a README, and
# upgrading is `npins update htmx` rather than a curl somebody has to be
# trusted about.
#
# The assembly lives HERE, next to the collection it is about: which upstream,
# which artifact out of it, and what it is called once it lands. flake.nix only
# callPackages this (like acp/ and e2e/), and nix/olai.nix is only told where
# the result is.
#
# The output is a drop-in replacement for the source directory: same layout,
# same static/ contents, so `define-runtime-path static-dir "static"` resolves
# the same whether a consumer got the collection from here or from the repo.
{ lib, stdenvNoCC, sources }:

let
  # One row per vendored file: where it comes from, which path inside that
  # checkout, and the name it is served under. The served name is the same one
  # `live-scripts` lists in client.rkt — that list and this table are the two
  # halves of one fact, and live/tests/client.rkt fails if they disagree.
  assets = [
    {
      name = "htmx.min.js";
      src = sources.htmx;
      path = "dist/htmx.min.js";
    }
    {
      # The SSE extension moved out of the htmx repo for 2.x; it is its own
      # checkout, and unversioned upstream — pinned by revision.
      name = "sse.js";
      src = sources.htmx-extensions;
      path = "src/sse/sse.js";
    }
    {
      # `idiomorph-ext`, NOT plain `idiomorph`: the bundle that also calls
      # htmx.defineExtension("morph"), which is what makes hx-swap="morph:…"
      # a swap rather than an unknown word.
      name = "idiomorph.min.js";
      src = sources.idiomorph;
      path = "dist/idiomorph-ext.min.js";
    }
  ];
in
stdenvNoCC.mkDerivation {
  pname = "live";
  version = "0.1";

  # What the collection IS, said once — not everything in this directory
  # minus what we regret afterwards. Two things here are not part of it: this
  # file, which is about producing the package rather than in it, and
  # examples/, where each example is its own artifact with its own
  # default.nix. Stating it as the source has a second effect worth more than
  # the tidiness: an edit under examples/ is not an input to this derivation,
  # so it cannot rebuild the framework — or olai, which consumes it. They
  # share a directory (raco refuses to link a package inside another package's
  # directory) and nothing else.
  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.difference ./. (lib.fileset.unions [ ./default.nix ./examples ]);
  };

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall

    mkdir -p $out
    cp -a ./* $out/
    chmod -R u+w $out

    ${lib.concatMapStringsSep "\n" (a: ''
      install -m 0444 "${a.src}/${a.path}" "$out/static/${a.name}"
    '') assets}

    runHook postInstall
  '';

  meta = with lib; {
    description = "Live views for Racket web apps: an SSE hub and an htmx + idiomorph client runtime";
    license = licenses.agpl3Plus;
  };
}
