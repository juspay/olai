# A plugin whose default.nix returns an attrset with an unknown key — the fold
# must refuse it by name.
{ pkgs, pins, kit, b2n }:
{
  bogus = "the fold must refuse this key";
}