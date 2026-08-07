#lang olai

Daily notes ^daily
  : Fictional demo of @include composition, now via GLOB: the one line
  : below matches every fragment under Daily/, spliced in lexicographic
  : order — date-named files land chronologically by construction. Drop
  : a new 2026-09.rkt into the directory while `olai serve` runs and it
  : appears live, no restart.

2026
  @include Daily/*.rkt
  *standup
