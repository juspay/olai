# A plugin whose manifest declares a knob its default.nix never supplies — the
# fold must refuse, naming the knob. (A wrapper that never bakes a promised
# default is the settings panel expecting a row that cannot be answered.)
{ pkgs, pins, kit, b2n, acpShim ? null }:
{
  knobs = { };
}