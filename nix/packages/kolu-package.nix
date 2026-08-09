# Factory: narrow the npins-pinned kolu source to a single workspace
# package. No vendoring — the @kolu/* surface libraries live upstream in
# juspay/kolu; olai consumes them the way odu and drishti do.
{ pkgs }:
name: pkgs.runCommand "kolu-${name}"
{
  meta = {
    description = "@kolu/${name} source extracted from juspay/kolu";
    homepage = "https://github.com/juspay/kolu";
  };
}
  ''
    cp -r ${(import ../../npins).kolu}/packages/${name} $out
  ''
