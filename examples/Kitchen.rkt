#lang olai

kitchen remodel #project
  : Fiction, like the rest of examples/ — and the demo of the graph beyond
  : containment. The tree says what CONTAINS what; the lines below say what
  : comes after what, and the checker refuses an ordering that runs in a
  : circle. An edge never moves a node: it points at one.
  [x] demo the old cabinets ^demo
    : done, so nothing waits on it any more
  order the new ones ^order
    : blocked by the line under "clear the driveway" — the other direction,
    : written where the writer happened to think of it
    @date 2026-08-10
  install ^install
    : after two things, one of them still open, so this is blocked and stays
    : off today's plate however its date reads
    @after ^order
    @after ^demo
  paint
    : @see is a link and nothing more. No ordering, no blocking, and two
    : nodes may point at each other all day
    @after ^install
    @see ^colour
  pick a colour ^colour
    : Warm white. The samples are in the garage.
    @see ^install
  clear the driveway
    @blocks ^order
