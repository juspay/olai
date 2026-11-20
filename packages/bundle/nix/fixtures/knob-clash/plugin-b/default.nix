{ pkgs, pins, kit, b2n }:
{
  knobs.OLAI_SAME_KNOB = { kind = "file"; path = "${pkgs.hello}/bin/hello"; };
}
