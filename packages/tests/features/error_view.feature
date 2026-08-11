Feature: The error view
  A broken set is not a blank screen and not a stack trace. Errors are the
  product: the view replaces the sidebar and the tree entirely, names
  `file:line` for every one of them, groups them by the file that has to be
  edited, and keeps the ones implicating two files apart — because for those,
  "which file is broken" has no single answer, and filing them under either one
  would be a lie.

  @corpus:broken
  Scenario: A set that does not parse shows errors instead of a tree
    When I open the app
    Then the error view is shown
    And no outline tree is shown
    And no outline list is shown

  @corpus:broken
  Scenario: The error report still has the app chrome
    # The whole justification for collapsing the corner-pills special case:
    # a reader of a set that never loaded deserves the connection answer most
    # of all, and the header is the one home for it. No burger — there is no
    # directory column to put away.
    When I open the app
    Then the error view is shown
    And the app header is on screen
    And the app chrome is inside the header
    And there is no burger

  @corpus:broken
  Scenario: A line that is not JSON is named by file and line
    # pantry.jsonl:3 has an unquoted key. Syntax is checked before meaning, so
    # this is the error this corpus is guaranteed to show.
    When I open the app
    Then the error view shows an error with code "not-json"
    And the error group for "pantry.jsonl" is shown
    And the error group for "pantry.jsonl" shows an error at "pantry.jsonl:3"

  @corpus:tangled
  Scenario: Every error is listed, and every single-file error sits under its file
    When I open the app
    Then the error view is shown
    And an error is listed at "attic.jsonl:3"
    And an error is listed at "cellar.jsonl:2"
    And an error is listed at "cellar.jsonl:3"
    And an error is listed at "cellar.jsonl:4"
    And the error group for "attic.jsonl" shows an error at "attic.jsonl:3"
    And the error group for "cellar.jsonl" shows an error at "cellar.jsonl:4"

  @corpus:tangled
  Scenario: Errors implicating two files get their own section
    # cellar.jsonl:2 names a parent that lives in attic.jsonl; cellar.jsonl:3
    # re-uses an id attic.jsonl:2 claimed first. Neither file is "the" broken one.
    When I open the app
    Then the cross-file section is shown
    And the cross-file section shows an error with code "foreign-parent"
    And the cross-file section shows an error with code "duplicate-id"

  @corpus:tangled
  Scenario: A single-file error stays out of the cross-file section
    # cellar.jsonl:4 points at `nowhere` — nothing declares it, so no second
    # file is implicated and the error belongs to cellar.jsonl alone.
    When I open the app
    Then the cross-file section does not show an error with code "unknown-parent"
