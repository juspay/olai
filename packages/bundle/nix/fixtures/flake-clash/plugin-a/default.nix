# Two plugins claiming one flake output name — the fold must refuse, naming both.
{ pkgs, pins, kit, b2n }:
{
  packages.same-output = pkgs.hello;
}