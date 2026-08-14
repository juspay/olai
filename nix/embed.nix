# The embedder `olai web` spawns for search-by-meaning — the binary AND the
# weights, both in olai's own closure.
#
# The whole reason this file exists is the parking verdict on PR #149: the
# first semantic-recall implementation embedded through a running Ollama, and
# HACKING.md's rule is absolute — olai requires NO dependency outside Nix
# itself. So the model server is `pkgs.llama-cpp` and the model is a
# fixed-output derivation, which together mean a nix-built olai fetches nothing
# at run time and expects nothing to be installed. Same treatment, and the same
# argument, as `acp-agent.nix` gives the chat panel's agent.
#
# `pkgs.llama-cpp` STOCK, not overridden. `blasSupport = false` would drop
# BLAS, OpenBLAS and gfortran and take the closure delta from 159 MB to 41 MB —
# but that derivation is in no binary cache, so every user and every CI lane
# would compile llama.cpp locally (measured: 3m27s on 16 cores). The lever is
# one word if that trade ever inverts; the numbers behind the choice are in
# docs/brainstorming/semantic-recall.md.
{ pkgs }:
let
  # bge-small-en-v1.5, q8_0: 33M parameters, 384 dimensions, a 512-token
  # window, MIT. Small enough that the weights are 37 MB and a query embeds in
  # under 5 ms on a CPU, good enough that a paraphrase outranks noise by a
  # clear margin (the measured floor is 0.62; see the design doc).
  #
  # Pinned by REVISION rather than `main`: a fixed-output derivation whose URL
  # floats breaks the day upstream re-uploads, and this conversion repo has
  # been still since 2024-02.
  rev = "d32f8c040ea3b516330eeb75b72bcc2d3a780ab7";
  model = pkgs.fetchurl {
    name = "bge-small-en-v1.5-q8_0.gguf";
    url =
      "https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/resolve/${rev}/bge-small-en-v1.5-q8_0.gguf";
    hash = "sha256-7Djo2hQllrqpExJK5QVQ3ihLaRa/WVd+8vDLlmDC9RQ=";
    meta = {
      description = "bge-small-en-v1.5 sentence embeddings, GGUF q8_0";
      homepage = "https://huggingface.co/BAAI/bge-small-en-v1.5";
      license = pkgs.lib.licenses.mit;
    };
  };
in
{
  # The two halves, as derivations — `default.nix` interpolates them into the
  # wrapper and re-exports them so `nix build .#olai-embed-server` /
  # `.#olai-embed-model` can weigh exactly what this feature adds.
  llama = pkgs.llama-cpp;
  inherit model;

  # Where the server binary sits inside its derivation. One spelling, because
  # the wrapper and `scripts/embedder.sh` must not be free to disagree.
  serverBin = "bin/llama-server";
}
