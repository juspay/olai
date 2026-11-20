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
    When I fold the note of "order"
    Then the row "order" is folded
    And the description of "order" is a preview of "Two ways to go:"

  Scenario: Space opens a focused pilcrow, and closes it again
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
    When I open the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I press "Escape"
    Then the row "order" is folded

  Scenario: The open state is three layers, in order
    When I open the note of "order"
    Then the row "order" is open
    And the description of "order" renders bold text "walnut"
    And the description of "order" is under its title

  Scenario: Cozy keeps the clamped line every row used to have
    When I read the outline with Notes on "cozy"
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks
    And the description of "order" is under its title
    And the description of "order" is clamped to one line
    When I click the note of "order"
    Then the note of "order" is being typed
    And the note being typed holds the source of "order"

  Scenario: Open starts every row open
    When I read the outline with Notes on "open"
    Then the row "order" is open
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
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
    When I tap the note of "order"
    Then the note of "order" is being typed

  Scenario: A zoomed page always shows the subject's note in full
    When I open the node "order"
    Then the zoomed node is "order"
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the node "order" shows the date "2026-08-10"
