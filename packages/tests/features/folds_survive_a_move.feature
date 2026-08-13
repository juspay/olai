@scratch:good
Feature: A fold survives the node moving
  The other half of `folds_are_remembered.feature`, and its own file for one
  reason: this one WRITES the directory it is served, so it needs a private copy
  of the corpus and a server of its own (`@scratch:`), while everything beside
  it reads a shared one.

  It is the claim that keying by node id was FOR. A place key is the chain of
  records above a row, so it changes the moment a node moves; an id does not.
  `archive` is the move this app actually has — the record goes to
  Archive.jsonl with its id kept, and the file it left goes on being served with
  the rest of its nodes — and a memory that pruned each file's ids against that
  same file would read "house.jsonl does not declare it any more" as a deletion
  and quietly forget the fold. Gone means gone from the SET.

  What is pinned here is the MEMORY, and since the Trash arrived that is all
  that can be: an archive is no longer an outline a reader opens, and the Trash
  draws no fold controls, so "still folded where it lands" is a claim about the
  store rather than about anything on screen. The fold is kept for a file this
  reader can no longer fold — which is right the day the node comes back out.

  Scenario: A node moved to the Trash keeps its fold in the memory, under the file it landed in
    Given I open the outline "house.jsonl"
    When I collapse the node "install"
    Then the node "install" is collapsed
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then the node "install" is not shown
    # A fold somewhere else first, because the prune is lazy: a dropped id would
    # otherwise still be sitting in this tab's merged set, and the row would
    # draw collapsed for a reason that dies on the next click.
    When I collapse the node "kitchen"
    # The claim itself, read out of this browser's own memory: the id was
    # re-filed under the archive rather than forgotten. Where it is now SEEN is
    # the Trash — an archive is not an outline you open and fold, so the row
    # being drawn there is what "it landed somewhere" looks like now.
    Then this browser remembers "install" folded in "Archive.jsonl"
    When I open the Trash
    Then the Trash lists the node "install"
    And there should be no page errors
