Feature: One broken outline degrades alone
  A broken file is not a blank screen and not a stack trace. Errors are the
  product: the file that is broken keeps its place in the sidebar, its own page
  shows the validator's rows — `file:line` for every one of them, where you
  would fix them — and every other outline in the directory is live, drawn and
  editable beside it. Over all of them sits one line per broken FILE, naming it
  and counting its rows, never the flood.

  That is the human's ruling of 2026-08-29, and it replaced an all-or-nothing
  load: a directory with one bad line in it used to serve nothing at all, and
  two dangling `see` edges took a whole vault off the screen for thirty minutes
  (`cold-boot-all-or-nothing`). There is no whole-set failure left to show here
  — a directory nothing can even LIST fails to open, so `olai web` refuses to
  start rather than serving a page about it.

  @corpus:broken
  Scenario: The healthy outline is live beside two broken ones
    When I open the app
    And I open the outline "larder.olai"
    Then the node "jars" is shown
    And the outline "pantry.olai" is marked unreadable
    And the outline "shed.olai" is marked unreadable

  @corpus:broken
  Scenario: A line that is not JSON is named by file and line, on that file's page
    When I open the app
    And I open the unreadable outline "pantry.olai"
    Then the outline failure shows an error with code "not-json"
    And the outline failure shows an error at "pantry.olai:3"
    And no outline tree is shown

  @corpus:broken
  Scenario: A file that READS and does not fit degrades exactly the same way
    When I open the app
    And I open the unreadable outline "shed.olai"
    Then the outline failure shows an error with code "unknown-parent"
    And the outline failure shows an error at "shed.olai:2"

  @corpus:broken
  Scenario: A broken file's page keeps the sidebar and the chrome
    When I open the app
    And I open the unreadable outline "pantry.olai"
    Then the app header is on screen
    And the app chrome is inside the header

  @corpus:broken
  Scenario: The summary names the broken files, and links to them
    When I open the app
    And I open the outline "larder.olai"
    Then the stale banner is shown
    And the stale banner names "pantry.olai" as "unparsed"
    And the stale banner names "shed.olai" as "invalid"
    And the stale banner enumerates nothing
    And the stale banner links to "pantry.olai"

  @corpus:broken
  Scenario: An edge pointing INTO a broken file does not break the file that holds it
    When I open the app
    And I open the outline "larder.olai"
    Then the node "jars" is shown
    And the stale banner names "pantry.olai" as "unparsed"

  @corpus:tangled
  Scenario: A finding whose two files SHARE the fault darkens both
    When I open the app
    And I open the unreadable outline "cellar.olai"
    Then the outline failure shows an error with code "duplicate-id"
    When I open the unreadable outline "attic.olai"
    Then the outline failure shows an error with code "duplicate-id"

  @corpus:tangled
  Scenario: A finding that merely POINTS at a second file darkens one
    When I open the app
    And I open the unreadable outline "cellar.olai"
    Then the outline failure shows an error with code "foreign-parent"
    And the outline failure shows an error at "cellar.olai:2"
    When I open the unreadable outline "attic.olai"
    Then the outline failure does not show an error at "cellar.olai:2"

  @corpus:tangled
  Scenario: A single-file finding stays on its own file's page
    When I open the app
    And I open the unreadable outline "attic.olai"
    Then the outline failure shows an error at "attic.olai:3"
    And the outline failure does not show an error at "cellar.olai:4"

  @corpus:tangled
  Scenario: The file a broken record POINTS AT stays live
    When I open the app
    And I open the outline "porch.olai"
    Then the node "sand" is shown
    And the stale banner names 2 files
    And the stale banner names "attic.olai" as "invalid"
    And the stale banner names "cellar.olai" as "invalid"
