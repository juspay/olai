@scratch:good
Feature: Inline markdown in titles
  Racket rendered titles as INLINE-ONLY markdown — bold, links, code, and no
  block elements. Olai uses the same sanitised pipeline a note and a document
  go through, forced down to phrasing content so a heading or a fence cannot
  break a tree row's layout. Tags stay a separate view-time split.

  These edit the served directory, so they are `@scratch:` — a private copy of
  the `good` corpus, thrown away with the scenario.

  Background:
    Given I open the outline "house.olai"

  Scenario: A title renders inline markdown
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"**take out** the old `counters`","props":{"status":"done","since":"2026-08-03"}}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","props":{"status":"doing","since":"2026-08-05","date":"2026-08-10"}}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","props":{"after":["order"]}}
      {"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}
      """
    Then the title of "demo" renders bold text "take out"
    And the title of "demo" renders code "counters"
    And the title of "demo" does not show its markdown source
    And the node "demo" has the title "take out the old counters"
    And the title of "kitchen" styles the tag "home"
    And there should be no page errors

  Scenario: A title with block markdown stays phrasing
    # A heading, a list or a fence in a title must not produce block elements
    # that break the row's layout. Words stay; boxes do not.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"# not a heading"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"- nor a list item"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"just plain"}
      """
    Then the title of "kitchen" does not render as markdown blocks
    And the title of "demo" does not render as markdown blocks
    And the node "kitchen" has the title "not a heading"
    And the node "demo" has the title "nor a list item"
    And there should be no page errors
