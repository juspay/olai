{ pkgs, pins }:
let
  contractDoor = import ./nix/contract.nix { inherit pkgs; };
in
{
  mark = import ./nix/mark.nix { inherit pkgs; };
  npmAdapter = import "${pins.kolu}/nix/npm-adapter.nix" { inherit pkgs; };
  contract = contractDoor.contract;
  contractProblems = contractDoor.contractProblems;
  knobShell = import ./nix/knob-shell.nix { inherit pkgs; };
}
