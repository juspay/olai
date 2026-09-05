# Chromium-only playwright browser set. ekapkgs has no playwright-driver, and
# e2e only launches chromium (packages/tests/support/hooks.ts). Firefox/webkit
# stay out: firefox-bin is missing from ekapkgs and webkit's closure is huge.
{ lib
, callPackage
, linkFarm
, runCommand
, makeFontsConf
, stdenv
}:
let
  inherit (stdenv.hostPlatform) system;
  throwSystem = throw "Unsupported system: ${system}";
  browsersJSON = (lib.importJSON ./browsers.json).browsers;
  fontconfig_file = makeFontsConf { fontDirectories = [ ]; };

  components = {
    chromium = callPackage ./chromium.nix {
      inherit system throwSystem fontconfig_file;
      inherit (browsersJSON.chromium) revision browserVersion;
    };
    chromium-headless-shell = callPackage ./chromium-headless-shell.nix {
      inherit system throwSystem;
      inherit (browsersJSON."chromium-headless-shell") revision browserVersion;
    };
    ffmpeg = callPackage ./ffmpeg.nix {
      inherit system throwSystem;
      inherit (browsersJSON.ffmpeg) revision;
    };
  };

  browsers = linkFarm "playwright-browsers" (
    lib.listToAttrs (
      map
        (name:
          lib.nameValuePair
            "${lib.replaceStrings [ "-" ] [ "_" ] name}-${browsersJSON.${name}.revision}"
            components.${name})
        [ "chromium" "chromium-headless-shell" "ffmpeg" ]
    )
  );
in
runCommand "playwright-driver"
{
  passthru = { inherit browsers; };
  meta.description = "Playwright 1.61.1 chromium browsers for olai e2e";
} "mkdir -p $out"
