@corpus:good
Feature: Notes on the title line
  A description that always opens in full is a page of three nodes. Things-
  style, adopted: the title line itself carries a gray ellipsized plain-text
  snippet (initial characters only); there is no density switch and no per-
  place unfold cell. Hovering the row expands it in place to the full note,
  the date badge and the see links; mouse-out collapses. On a phone (no
  hover), tapping the snippet toggles the same expansion. The zoomed page
  keeps the full note always.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: By default a note is a same-line plain-text snippet
    # `order` stores a multi-line markdown note with a list and bold. The
    # snippet is the first line as words, on the title row, not under it and
    # not as rendered blocks.
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks
    And the description of "order" is on the same line as its title

  Scenario: Hovering the row expands the note in place
    When I hover the row of "order"
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the description of "order" does not show its markdown source
    And the node "order" shows the date "2026-08-10"
    And the node "order" sees "herbs" as "the herb bed by the door"
    When I stop hovering the row of "order"
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks
    And the node "order" shows no date

  Scenario: A zoomed page always shows the subject's note in full
    When I open the node "order"
    Then the zoomed node is "order"
    # The subject is the page: its note is not a snippet.
    And the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the node "order" shows the date "2026-08-10"

  @phone
  Scenario: On a phone, tapping the snippet toggles the same expansion
    When I tap the note snippet of "order"
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the node "order" shows the date "2026-08-10"
    When I tap the open note of "order"
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks
