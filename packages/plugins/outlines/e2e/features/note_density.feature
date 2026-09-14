@corpus:good
Feature: A row is its title, and the pilcrow opens the rest
  The quiet outline's first move. A row draws its TITLE and nothing else: a
  node carrying a note says so with a small dim pilcrow beside the title, and
  pressing that — or Space, with it focused — opens the row under it. Pressing
  it again folds it back, as does clicking away or Escape.

  What an UNTOUCHED row starts as is a view-wide preference with three answers
  (`client/settings/density.ts`), set in the preferences panel and stored in
  this browser: Cozy is the default — the title and one dim clamped line of
  the note. Compact is the title alone. Open starts every row open. It is a
  DEFAULT and never a lock — the pilcrow works at all three.

  The OPEN state is three inline layers and no grid: the title line says it is
  open (the pilcrow accents, the tags brighten), then the node's custom
  properties as one dot-separated run, then the note. The zoomed page is
  unchanged: the subject IS the page, so its note is always in full.

  Background:
    Given I open the outline "house.olai"

  Scenario: By default a row shows the first line of its note
    # Cozy: the title, and one clamped line. The rest of a multi-line note
    # stays behind the pilcrow until somebody asks for it.
    Then the node "order" shows a pilcrow
    And the description of "order" is a preview of "Two ways to go:"
    And the description of "order" is clamped to one line
    And the row "order" is folded

  Scenario: The pilcrow opens the row, and folds it again
    When I open the note of "order"
    Then the row "order" is open
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the description of "order" does not show its markdown source
    And the node "order" sees "herbs" as "the herb bed by the door"
    # THE REGRESSION THIS EXISTS FOR. The pilcrow sits on the title line and
    # the open body is the box the click-away calls "inside", so the mark was a
    # press OUTSIDE an open row: the pointerdown dismissed it and the click
    # behind it opened it straight back up. It is the dismissal's TRIGGER now
    # (`client/dismiss.ts`), which is the same fix a portalled trigger gets.
    When I fold the note of "order"
    Then the row "order" is folded
    And the description of "order" is a preview of "Two ways to go:"

  Scenario: Space opens a focused pilcrow, and closes it again
    # A `<button>` answers Space without this app claiming the key, which is
    # the only row-level focus olai has — the other caret is the title editor's
    # and the keys there are the editor's (`client/keys.ts`).
    When I press Space on the pilcrow of "order"
    Then the row "order" is open
    When I press Space on the pilcrow of "order"
    Then the row "order" is folded

  Scenario: Clicking away folds the open row
    When I open the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I click away from the note of "order"
    Then the row "order" is folded

  Scenario: Escape folds the open row
    # The client's one dismissal (`client/dismiss.ts`) is a pointer outside it
    # AND Escape. It is the model this note already keeps: expanding and
    # editing are one state and you leave both at once
    # (`keyboard_editing.feature`), and Escape has always been how a caret
    # leaves.
    When I open the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I press "Escape"
    Then the row "order" is folded

  Scenario: The open state is three layers, in order
    # Title line, then the properties run, then the note. The run is drawn as
    # dim key-value pairs on one wrapping line — never a grid, never a table,
    # never a form — and it holds the CUSTOM keys only: the id, the mark and
    # the date are already on the row, in the glyph and on the date badge.
    When I open the note of "order"
    Then the row "order" is open
    And the description of "order" renders bold text "walnut"
    And the description of "order" is under its title

  # A property is only in the open state too, and a node carrying one gets a
  # pilcrow for it — both are `properties.feature`'s, since writing one is
  # what that feature is about.

  # ── the density switch ───────────────────────────────────────────────

  Scenario: Cozy keeps the clamped line every row used to have
    When I read the outline with Notes on "cozy"
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks
    And the description of "order" is under its title
    And the description of "order" is clamped to one line
    # The clamped line is a second door — a click in the words you were
    # reading puts the caret in the note AT them, one click rather than the
    # pilcrow and a second click into what it opened. The pilcrow's open is
    # still what it is (above).
    When I click the note of "order"
    Then the note of "order" is being typed
    And the note being typed holds the source of "order"

  Scenario: Open starts every row open
    When I read the outline with Notes on "open"
    Then the row "order" is open
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    # A default and not a lock: this row folds, and the ones beside it do not
    # come with it.
    When I fold the note of "order"
    Then the row "order" is folded

  Scenario: Compact is a pick, and the switch comes back to it
    When I read the outline with Notes on "open"
    Then the row "order" is open
    When I read the outline with Notes on "compact"
    Then the row "order" is folded
    And the node "order" draws nothing under its title

  @phone
  Scenario: On a phone, tapping the pilcrow opens the row
    When I tap the pilcrow of "order"
    Then the row "order" is open
    And the description of "order" renders bold text "walnut"
    And the node "order" sees "herbs" as "the herb bed by the door"
    # The same two gestures a pointer gets, and the second is what puts a
    # phone's keyboard up.
    When I tap the note of "order"
    Then the note of "order" is being typed

  Scenario: A zoomed page always shows the subject's note in full
    When I open the node "order"
    Then the zoomed node is "order"
    # The subject is the page: the fold does not apply to it.
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the node "order" shows the date "2026-08-10"
