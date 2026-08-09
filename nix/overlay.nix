# Exposes the @kolu/* workspace packages olai consumes as Nix-store sources.
# A new consumer is a one-line addition.
final: _prev:
let
  mkKoluPackage = import ./packages/kolu-package.nix { pkgs = final; };
in
{
  kolu-surface = mkKoluPackage "surface";
  # @kolu/surface imports @kolu/log (its structured-logger seam), and a
  # hydrated source resolves its own imports from where it was copied — so
  # the consumer hydrates the transitive kolu leaves too.
  kolu-log = mkKoluPackage "log";
}
