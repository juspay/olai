# Two plugins claiming one hydrate destination — the fold must refuse, naming both.
{ pkgs, pins, kit, b2n }:
{
  hydrate = [ { src = "/src-a"; dest = "@clash/same"; } ];
}