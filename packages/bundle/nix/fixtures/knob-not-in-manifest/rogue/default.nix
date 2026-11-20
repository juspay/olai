{ pkgs, pins, kit, b2n }:
{
  knobs.OLAI_UNKNOWN_TO_MANIFEST = { kind = "file"; path = "${pkgs.hello}/bin/hello"; };
}
