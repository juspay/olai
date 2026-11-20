{ pkgs, pins, kit, b2n }:
{
  generated."src/browser/mark.ts" = pkgs.writeText "mark" "// nope";
}
