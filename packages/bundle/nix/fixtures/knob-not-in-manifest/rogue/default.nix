# A plugin that SUPPLIES a knob its manifest does not declare — the fold must
# refuse, naming the knob. (The settings panel and the wrapper would otherwise
# disagree about which variables exist.)
{ pkgs, pins, kit, b2n }:
{
  knobs.OLAI_UNKNOWN_TO_MANIFEST = { kind = "file"; path = "${pkgs.hello}/bin/hello"; };
}