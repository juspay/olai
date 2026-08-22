Feature: One search box, and the page it widens to
  The complaint, verbatim from the roadmap: `#next` was tagged on five nodes in
  three outlines and nothing in this app would list them together. The filter
  box, `?q=` and clicking a tag all narrowed ONE page; the two doors that could
  see the whole directory were shortlists for jumping TO a node — eight rows, no
  address, not pinnable, gone the moment the box lost the caret.

  There is one box now, and it widens (docs/brainstorming/one-search-box.md, the
  human's ruling of 2026-08-21). What these scenarios pin is the arc a reader
  actually walks: type on the page in front of you, be TOLD there is more
  elsewhere, go there in one gesture without retyping a word, and keep the
  result.

  `old` is the query most of this is built on, and deliberately: the good corpus
  writes it in three files at once — `take out the old counters` in house.olai,
  `the cold frames` in garden.olai, `**bold**` inside the August note — plus one
  document. So it is exactly the shape the complaint was about, small enough to
  count.

  Background:
    Given I open the app

  @corpus:good
  Scenario: The bar says how many more the directory holds, and that line is the door
    Given I open the outline "house.olai"
    When I filter the page by "old"
    Then the filter found "1 of 10"
    And the filter offers "· 3 more elsewhere — search everywhere"
    # THE SAME QUERY, one press wider. The words are the address either way, so
    # nothing is retyped.
    When I widen the filter
    Then the search page is open
    And the address is exactly "/search?q=old"
    And the filter box holds "old"
    And there should be no page errors

  @corpus:good
  Scenario: Enter in the box is the same gesture
    # The one search box in this app has no list under it, so Enter was free.
    Given I open the outline "house.olai"
    When I filter the page by "old"
    And I press Enter in the filter box
    Then the search page is open
    And the address is exactly "/search?q=old"

  @corpus:good
  Scenario: A page that IS the whole answer offers nothing more
    # This app's zero rule, read once more: a part that is zero is a part the
    # reader does not need, and here the door would lead nowhere new. `#home` is
    # written on exactly one node in the whole directory.
    Given I open the outline "house.olai"
    When I filter the page by "#home"
    Then the filter found "1 of 10"
    And the filter offers nothing more elsewhere
    And there should be no page errors

  @corpus:good
  Scenario: The everywhere page groups its rows by file, ancestry kept
    # The filter, widened — the same `keeping` prune every narrowed page uses,
    # run over every outline. A match keeps its subtree; a row that did not
    # match survives only as the ancestry that leads to one, because a bare
    # title means nothing until you can see what it is under.
    Given I search everywhere for "old"
    Then the search groups are "Daily/2026-08.olai, garden.olai, house.olai"
    And the filter found "3 matches in 3 files · 1 document"
    And the search page lists the node "take out the old counters"
    And the search row "take out the old counters" is a match
    # …and the ancestor that leads to it is drawn as context, which is the
    # distinction the whole feature is made of.
    And the search row "kitchen remodel #home" is kept as context
    And there should be no page errors

  @corpus:good
  Scenario: A row of the everywhere page goes to the node
    # What the shortlist could never be: an answer you can come back to.
    Given I search everywhere for "old"
    When I press the search row "take out the old counters"
    Then the address is "/#demo"
    And the zoomed node is "demo"

  @corpus:good
  Scenario: A word that only a document holds is a row here
    # The other half of the directory (docs/search.md's "…and documents"), and
    # the half a page filter cannot show: a filter selects nodes, and the one
    # page made of prose is the one page with no box.
    Given I search everywhere for "cabinetmaker"
    Then the search page lists the document "finishes.md"
    And there should be no page errors

  @corpus:good
  Scenario: Nothing typed is a page that says so, not a page that says "no matches"
    # "Type in the box" is a claim about the page; "no matches" is a claim about
    # the query, and the bar is where that one is made. A filtered page says one
    # or the other, never both.
    Given I search everywhere for ""
    Then the search page is open
    And the search page lists no node "take out the old counters"

  @scratch:good
  Scenario: An everywhere search is a pin, so a saved cross-vault search is a row on the shelf
    # A query is the one part of an address nothing in the set can name, so the
    # shelf asks what to call it — exactly as it does for `/house.olai?q=is:todo`.
    # This page is not a fourth kind of thing.
    Given I search everywhere for "old"
    When I pin the page
    Then the palette asks "a name for this pin — Enter with nothing pins it unnamed"
    When I name the pin "Everything old"
    Then the pinned shelf holds "/search?q=old"
    And the pin "/search?q=old" is named "Everything old"
    And the pin "/search?q=old" carries the query "old"
    When I open the outline "garden.olai"
    And I follow the pin "/search?q=old"
    Then the address is exactly "/search?q=old"
    And the search page is open
    And the filter box holds "old"
    And there should be no page errors

  @corpus:good
  Scenario: ⌘K keeps its commands and hands a non-command query to the box
    # The palette's node-hit half is gone. What a typed word produces is a DOOR
    # to the one box rather than a preview of eight of what is behind it — and
    # it is offered even over a query that matched a command, because a door
    # that appeared only sometimes is a door you cannot learn.
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "today" into the palette
    Then the palette offers "Go to today"
    And the palette offers "Search this page for “today”"
    When I type "cabinets" into the palette
    Then the palette offers "Search this page for “cabinets”"
    And the palette does not offer "order the new cabinets"
    When I pick the palette item "Search this page for “cabinets”"
    Then the command palette is closed
    And the address is exactly "/house.olai?q=cabinets"
    And the filter box holds "cabinets"
    And there should be no page errors

  @corpus:good
  Scenario: …and on a page with no box of its own, straight to the everywhere page
    # A document is prose, so it carries no `?q=` and draws no bar. A door that
    # did nothing there would be a door that works on some pages.
    When I open the document "finishes.md"
    And I press the palette shortcut
    And I type "cabinetmaker" into the palette
    Then the palette offers "Search everywhere for “cabinetmaker”"
    When I pick the palette item "Search everywhere for “cabinetmaker”"
    Then the search page is open
    And the address is exactly "/search?q=cabinetmaker"
    And the search page lists the document "finishes.md"

  # ── the number is a COMPLEMENT, at every scope ──────────────────────
  #
  # The widen line's number used to be a subtraction — a scopeless directory
  # total minus this page's own matched ids — which is the complement only where
  # the page's matches are a SUBSET of the directory's. Both reviewers of #334
  # constructed pages where they are not. It is `search.elsewhere` now
  # (`@olai/format`'s `elsewhere.ts`): the server reads the page, asks the
  # corpus the same question under the page's own archive rule, and counts what
  # the page does not put on screen.

  @corpus:good
  Scenario: A ZOOM counts the matches its own file holds outside the subtree
    # THE WORDING half of the fix. `pick` is on `hinges` and `knobs`, both in
    # house.olai and neither under `handles`, plus one document — so two of the
    # three the bar offers are in the file the reader is already standing in.
    # The old sentence called all three "in other files", which a reader could
    # check and find false in one click.
    Given I open the node "handles"
    When I filter the page by "pick"
    Then the filter offers "· 3 more elsewhere — search everywhere"
    # …and widening shows exactly those: the two same-file rows the zoom left
    # out, under the file they live in.
    When I widen the filter
    Then the search groups are "house.olai"
    And the search page lists the node "pick the hinges"
    And the search page lists the node "pick the knobs"
    And there should be no page errors

  @scratch:good
  Scenario: The TRASH counts the live matches it is not showing, not a difference
    # The case that was WRONG rather than misworded. The trash's rows are
    # archived; a directory-wide search leaves those out unless the query says
    # `is:trashed`, so the two sets are disjoint — the old subtraction took live
    # matches away for archived ones and the clamp at zero could hide the line
    # altogether.
    Given I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then "_olai/Trash.olai" holds the node "install"
    When I open the Trash
    And I filter the page by "the"
    # THE ARITHMETIC half of the fix, and the numbers say it exactly. Sixteen
    # matches — live nodes and documents — are not on this page. Three archived
    # rows hold "the" and ARE on it. The old formula subtracted the second from
    # a directory total that had already left the archive out: 16 − 3 = 13,
    # three short of the truth, and an archive bigger than the live answer drove
    # it to zero and took the line off the bar altogether. The complement is 16.
    Then the filter offers "· 16 more elsewhere — search everywhere"
    And there should be no page errors

  @corpus:good
  Scenario: Back from the everywhere page returns to the page it was widened from
    # Widening PUSHES where typing replaces: a keystroke narrows the page you
    # are standing on, and this goes to a different one. Replaced, Back skipped
    # the narrowed page it was opened from.
    Given I open the outline "house.olai"
    When I filter the page by "old"
    And I widen the filter
    Then the address is exactly "/search?q=old"
    When I go back
    Then the address is exactly "/house.olai?q=old"
    And the filter box holds "old"
    And there should be no page errors
