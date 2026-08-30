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
    # `larder.olai` is what makes this corpus a per-file corpus: nothing is
    # wrong with it, and it is drawn exactly as it would be in a vault where
    # nothing is wrong with anything.
    When I open the app
    And I open the outline "larder.olai"
    Then the node "jars" is shown
    And the outline "pantry.olai" is marked unreadable
    And the outline "shed.olai" is marked unreadable

  @corpus:broken
  Scenario: A line that is not JSON is named by file and line, on that file's page
    # pantry.olai:3 has an unquoted key. Syntax is checked before meaning, so
    # this is the error this corpus is guaranteed to show.
    When I open the app
    And I open the unreadable outline "pantry.olai"
    Then the outline failure shows an error with code "not-json"
    And the outline failure shows an error at "pantry.olai:3"
    And no outline tree is shown

  @corpus:broken
  Scenario: A file that READS and does not fit degrades exactly the same way
    # shed.olai:2 names a parent nothing declares. It parses perfectly — every
    # line is a well-formed record — and until the ruling that difference cost
    # the whole vault its tree. It costs this one file, in the same pane, with
    # the same rows.
    When I open the app
    And I open the unreadable outline "shed.olai"
    Then the outline failure shows an error with code "unknown-parent"
    And the outline failure shows an error at "shed.olai:2"

  @corpus:broken
  Scenario: A broken file's page keeps the sidebar and the chrome
    # The whole justification for it being a PANE rather than a screen: a broken
    # file costs the reader that file, so the directory column, the header and
    # the connection answer are all exactly where they were. The page it
    # replaced took the whole shell.
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
    # ONE LINE PER FILE and never the rows: this banner is over somebody else's
    # page, and inlining the enumeration is what `last-good-banner-flood` was.
    And the stale banner enumerates nothing
    And the stale banner links to "pantry.olai"

  @corpus:broken
  Scenario: An edge pointing INTO a broken file does not break the file that holds it
    # `larder.olai:2` has `see: ["flour"]`, and `flour` is declared on a line of
    # `pantry.olai` that did not parse. "No node declares `flour`" is a GUESS
    # while that file is mid-edit, so it is withheld rather than reported — and
    # a withheld finding may not take a healthy page down. This is the
    # 2026-08-25 cold boot, which was two `see` edges exactly like this one.
    When I open the app
    And I open the outline "larder.olai"
    Then the node "jars" is shown
    And the stale banner names "pantry.olai" as "unparsed"

  @corpus:tangled
  Scenario: A finding that names two files darkens both, and nothing else
    # cellar.olai:2 names a parent living in attic.olai; cellar.olai:3 re-uses an
    # id attic.olai:2 claimed first. Neither file is "the" broken one, so both
    # go dark and the row is on both pages — a reader reaches the fix from
    # wherever they were standing.
    When I open the app
    And I open the unreadable outline "cellar.olai"
    Then the outline failure shows an error with code "duplicate-id"
    And the outline failure shows an error with code "foreign-parent"
    When I open the unreadable outline "attic.olai"
    Then the outline failure shows an error with code "duplicate-id"
    And the outline failure shows an error with code "foreign-parent"

  @corpus:tangled
  Scenario: A single-file finding stays on its own file's page
    # attic.olai:3 points at `donate` — nothing declares it, and no second file
    # is named — so it belongs to attic.olai alone and cellar.olai never shows it.
    When I open the app
    And I open the unreadable outline "attic.olai"
    Then the outline failure shows an error at "attic.olai:3"
    And the outline failure does not show an error at "cellar.olai:4"

  @corpus:tangled
  Scenario: The third file is untouched by either of them
    When I open the app
    And I open the outline "porch.olai"
    Then the node "sand" is shown
