@corpus:good
Feature: One place to set how this browser reads
  A trigger in the app header opens a panel of rows, each a label, a control and
  a line under it read off the CHOICE IN FORCE — so the sentence changes when
  you press the control, and the panel answers "what did I just do" in the same
  gesture. The shape is kolu's settings popover; the backing store is
  deliberately not, because olai's preferences are client-local
  (`docs/architecture.md`). Nothing here is a cell, nothing crosses a wire, and
  nothing is committed.

  There is ONE door. The theme pill used to sit in the bar beside this trigger,
  which was a preference with a control of its own next to the control for the
  preferences — the same redundancy `one-git-indicator` closed for the two git
  chips. The chips are the panel's Theme row now; `theming.feature` is the whole
  of what they still promise, and it opens this panel to reach them.

  The Font row is the same shape as Theme: a catalog (`@olai/fonts`), an
  attribute on `<html>`, and a hint read off the choice in force. `fonts.feature`
  is the whole of what the select still promises.

  The Size row is the second half of "how this page is set", and it is a root
  font size: every length in this client is a `rem`, so one number moves the
  rows, the gutter and the panels together. It rides the shell's boot script
  beside the theme and the typeface, because a size taken up after the first
  paint would reflow the whole page under somebody who had just opened it.

  The Notes row is how much of a row is drawn by default — Compact, Cozy,
  Open — and what it moves is `note_density.feature`'s subject. What is here is
  that it is a preference like the others: it moves the page you are on,
  follows you to the next one, is stored in this browser under one BROWSER-wide
  key (not one per outline — "I read a tree as a list of titles" is a claim
  about the reader), and reaches every tab of it.

  Its three words need saying out loud, which is why one scenario below is
  about the HINT rather than about the tree: Cozy is the shape every row had
  before the fold existed, Open goes one step further than anything that did,
  and Compact — the default, because a fold whose default is the old behaviour
  is a feature nobody discovers — is the title alone.

  The Done row is the one row that is about a PAGE rather than about this
  browser's reader of it. What "done" means depends on the page — a roadmap
  reads as "what is next" and finished rows are clutter; a board of the day's
  lanes reads as "what happened" and they are the content — so each outline
  keeps its own pick, flipped in the same row the reader-wide switch used to
  sit in, scoped to the page in the focused pane. It moves the page you are
  reading, follows you into its zooms (a zoomed view is the same page and
  mints no pick of its own), and reaches every other tab of this browser. A
  page nobody has spoken about HIDES: every default is the same default, and
  a page flipped back to hidden is forgotten again — what is stored is the
  list of pages that show.

  Scenario: The preferences open from the header, and say whose they are
    When I open the app
    And I open the preferences
    Then the preferences are open
    And the preferences panel opens downward, clear of the bar
    And the panel says these preferences are this browser's
    And there should be no page errors

  Scenario: A keyboard opens it and is standing inside it
    # THE REGRESSION THIS EXISTS FOR. The theme chips used to be laid out inside
    # the trigger's own box, so they were the next thing in document order and
    # Tab reached them. This panel is portalled to the end of the body, which
    # puts it after the sidebar, the tree and everything else — so opening it
    # and leaving the caret on the trigger means the controls are not reachable
    # in any sense a person would accept.
    #
    # So the trigger and its panel are ONE tab cycle: opening moves the caret
    # into the panel, Shift+Tab goes back out to the trigger, and Tab goes in to
    # the first control.
    When I open the app
    And I focus the preferences trigger
    And I press Enter
    Then the preferences are open
    And the preferences panel has the focus
    When I press Shift+Tab
    Then the preferences trigger has the focus
    When I press Tab
    Then the first control in the preferences has the focus
    When I press Shift+Tab
    Then the preferences trigger has the focus

  Scenario: Tab does not walk out of an open panel
    # The other half of one cycle: the last control leads back to the trigger
    # rather than to the page underneath, which is what a portalled panel would
    # otherwise hand a keyboard.
    When I open the app
    And I open the preferences
    And I press Shift+Tab
    Then the preferences trigger has the focus
    When I press Shift+Tab
    Then the last control in the preferences has the focus

  Scenario: A page hides its finished work until it is asked not to
    # THE DEFAULT (ruled 2026-08-29): no stored pick, and the page behaves the
    # way the reader-wide switch left it set to hidden — finished rows wait
    # until somebody asks the page for them. `demo` is done; `order` is not.
    Given I open the outline "house.olai"
    Then the node "demo" is not shown
    And the node "order" is shown
    When I set Done to "visible"
    Then the Done row explains that finished work is "shown"
    And the Done row is about "house.olai"
    And this browser has stored that done nodes are "shown" on "house.olai"
    And the node "demo" is shown

  Scenario: The hint is read off the choice in force
    Given I open the outline "house.olai"
    When I set Done to "visible"
    Then the Done row explains that finished work is "shown"
    When I set Done to "hidden"
    Then the Done row explains that finished work is "hidden"
    And this browser has stored that done nodes are "hidden" on "house.olai"

  Scenario: Each page keeps its own pick
    # THE FEATURE, in two files: `house.olai` shows its finished work because
    # it was asked to; `garden.olai` has never been asked and hides by
    # default. And going back finds the first pick still where it was made —
    # the failure this fences is the old reader-wide switch, which would have
    # moved the roadmap's reading when the board was flipped.
    Given I open the outline "house.olai"
    When I set Done to "visible"
    And I press Escape on the preferences
    And I open the outline "garden.olai"
    Then the node "basil" is not shown
    And the Done row is about "garden.olai"
    When I open the outline "house.olai"
    Then the node "demo" is shown
    And this browser has stored that done nodes are "shown" on "house.olai"
    And this browser has stored that done nodes are "hidden" on "garden.olai"

  Scenario: A zoom is the same page, and mints no second pick
    # `Hiding done nodes works on a zoomed page too` in zoom_and_navigate is
    # the tree filter on a page opened first; this one is where the pick
    # comes FROM: the zoom reads the outline's, the row says so, and flipping
    # it there writes the outline's entry and nothing else.
    Given I open the outline "house.olai"
    When I set Done to "visible"
    And I press Escape on the preferences
    Then the node "demo" is shown
    When I zoom into the node "kitchen"
    Then the node "demo" is shown
    And the Done row is about "house.olai"
    When I set Done to "hidden"
    Then the node "demo" is not shown
    And this browser has stored that done nodes are "hidden" on "house.olai"

  Scenario: It is remembered, and it is this browser's
    # THE PIN FOR THE BOOT READ: the write is fenced by the stored-key steps
    # above; this one is that the first read after a reload honours the entry.
    Given I open the outline "house.olai"
    When I set Done to "visible"
    And I press Escape on the preferences
    Then the node "demo" is shown
    When I reload the page
    Then this browser has stored that done nodes are "shown" on "house.olai"
    And the Done row explains that finished work is "shown"
    And the node "demo" is shown

  Scenario: A preference set in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab —
    # which is what `followDonePages` is for, and what a reload scenario
    # cannot ask: deleting that line entirely would pass every other Done
    # scenario here. The theme has had this fence since it was written; this is
    # the same one for this row, through the same `storage` event — on the SAME
    # page, because that is what the pick is about now.
    Given I open the outline "house.olai"
    Then the node "demo" is not shown
    When a second tab sets Done to "visible"
    Then the node "demo" is shown
    And there should be no page errors

  Scenario: On a page the pick does not reach, the row says so
    # A day is a record of what happened — finished work is the content there,
    # never something to hide — so the strip is inert and presses neither
    # segment: there is no pick in force on a page with no tree, and drawing
    # one would be a claim about a reading the page does not make.
    Given I open the day "2026-08-03"
    Then the Done row cannot be set

  # ── how much of a row is drawn ───────────────────────────────────────

  Scenario: Notes moves the page you are reading, and is remembered
    Given I open the outline "house.olai"
    Then the row "order" is folded
    When I set Notes to "open"
    Then the Notes row explains that a row "already open"
    And this browser has stored that notes are "open"
    And the row "order" is open
    When I reload the page
    Then this browser has stored that notes are "open"
    And the row "order" is open

  Scenario: Picking a size sets the whole page, and is remembered
    Given I open the outline "house.olai"
    When I set Size to "medium"
    Then the page is set at "16px"
    And this browser has stored the size "medium"
    When I set Size to "larger"
    Then the page is set at "20px"
    When I reload the page
    # THE PIN FOR THE BOOT READ. The shell's inline script puts the stored size
    # on `<html>` while the document is still parsing, so the first paint is
    # already at it — a size taken up by the bundle instead would reflow every
    # line under a reader who had just opened the page.
    Then the page is set at "20px"
    And this browser has stored the size "larger"
