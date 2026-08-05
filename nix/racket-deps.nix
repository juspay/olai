# Racket packages from npins. Monorepos need a subdir; others install at root.
# Install order is bottom-up. markdown and olai use --deps force because
# catalog package names (parsack, gregor) differ from the lib package dirs.
{ lib, stdenvNoCC, sources }:
rec {
  # HAND-MAINTAINED TRANSITIVE CLOSURE. npins pins sources, it does not resolve
  # Racket package deps, so every dep of every dep is listed here by hand, in
  # install order. To add a package: read its info.rkt `deps`, drop the ones the
  # Racket distribution already ships (base, rackunit, ...), pin what is left
  # with npins, and add those rows ABOVE the package that needs them.
  racketPkgs = [
    { name = "memoize-lib"; pin = "memoize"; subdir = "memoize-lib"; }
    { name = "parsack-lib"; pin = "parsack"; subdir = "parsack-lib"; }
    { name = "threading-lib"; pin = "threading"; subdir = "threading-lib"; }
    { name = "cldr-core"; pin = "cldr-core"; subdir = null; }
    { name = "cldr-bcp47"; pin = "cldr-bcp47"; subdir = null; }
    { name = "cldr-dates-modern"; pin = "cldr-dates-modern"; subdir = null; }
    { name = "cldr-localenames-modern"; pin = "cldr-localenames-modern"; subdir = null; }
    { name = "cldr-numbers-modern"; pin = "cldr-numbers-modern"; subdir = null; }
    { name = "tzinfo"; pin = "tzinfo"; subdir = null; }
    { name = "gregor-lib"; pin = "gregor"; subdir = "gregor-lib"; }
    { name = "markdown"; pin = "markdown"; subdir = null; }
    { name = "unstable-pretty-lib"; pin = "unstable-pretty-lib"; subdir = null; }
    { name = "nanopass"; pin = "nanopass"; subdir = null; }
    { name = "css-expr"; pin = "css-expr"; subdir = null; }
  ];

  # Stage each npins source into $out/<name> for raco pkg install --copy.
  # Writable copies so we can strip markdown test modules that need
  # optional build-deps (sexp-diff, redex) not required at runtime.
  racketDeps = stdenvNoCC.mkDerivation {
    name = "olai-racket-deps";
    dontUnpack = true;
    # npins sources are fixed-output store paths; string context pulls them in.
    buildCommand = ''
      mkdir -p $out
      ${lib.concatMapStringsSep "\n" (p:
        let src = sources.${p.pin};
        in ''
          echo "staging ${p.name} from ${p.pin}"
          ${if p.subdir == null then ''
            cp -a "${src}" "$out/${p.name}"
          '' else ''
            cp -a "${src}/${p.subdir}" "$out/${p.name}"
          ''}
          chmod -R u+w "$out/${p.name}"
        '') racketPkgs}

      # markdown ships test modules that require sexp-diff/redex at compile
      # time; strip them so offline install only needs runtime deps.
      if [ -d "$out/markdown/markdown" ]; then
        rm -f "$out/markdown/markdown/"*test*.rkt \
              "$out/markdown/markdown/suite-test.rkt" \
              "$out/markdown/markdown/perf-test.rkt" \
              "$out/markdown/markdown/random-test.rkt" \
              "$out/markdown/markdown/redex-test.rkt" \
              "$out/markdown/markdown/example.rkt"
        rm -rf "$out/markdown/markdown/test" \
               "$out/markdown/MarkdownTest_1.0.3" \
               "$out/markdown/markdown/doc"
      fi
    '';
  };
}
