# Two plugins claiming one hydrate destination — the fold must refuse, naming both.
{ pkgs, pins, kit, b2n, acpShim ? null }:
{
  hydrate = [{ src = "/src-b"; dest = "@clash/same"; }];
}
