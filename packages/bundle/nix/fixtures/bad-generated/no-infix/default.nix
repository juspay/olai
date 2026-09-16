# A plugin whose `generated` path lacks the `.generated.` infix — the fold must
# refuse it by name (the root's gitignore glob and the fold's install both rely
# on the infix).
{ pkgs, pins, kit, b2n, acpShim ? null }:
{
  generated."src/browser/mark.ts" = pkgs.writeText "mark" "// nope";
}
