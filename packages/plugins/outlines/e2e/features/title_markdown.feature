@share-scratch
@scratch:good
Feature: Inline markdown in titles
  Racket rendered titles as INLINE-ONLY markdown — bold, links, code, and no
  block elements. Olai uses the same sanitised pipeline a note and a document
  go through, forced down to phrasing content so a heading or a fence cannot
  break a tree row's layout. Tags stay a separate view-time split.

  These edit the served directory, so they are `@scratch:`. They share one
  copy per worker (`@share-scratch`); the corpus is restored between scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes

  Scenario: A title renders inline markdown
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"**take out** the old `counters`","done":"2026-08-03"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","after":["order"]}
      {"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}
      """
    Then the title of "demo" renders bold text "take out"
    And the title of "demo" renders code "counters"
    And the title of "demo" does not show its markdown source
    And the node "demo" has the title "take out the old counters"
    And the title of "kitchen" styles the tag "home"
    And there should be no page errors

  Scenario: A title with block markdown stays phrasing
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

  Scenario: A title nests one emphasis inside the other, and a filter lights inside it
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"a **b *c* d** e"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"plan the **kitchen *remodel* budget** carefully"}
      """
    Then the title of "demo" renders bold text "b c d"
    And the title of "demo" renders italic text "c"
    And the title of "demo" does not show its markdown source
    And the node "demo" has the title "a b c d e"
    When I filter the page by "remodel"
    Then the node "order" is a match
    And the node "order" lights "remodel"
    And there should be no page errors

  Scenario: A filter lights its word inside a code span and inside a link
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"run `just check` before pushing"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"see the [cabinet spec](https://example.com/spec#home) first"}
      """
    When I filter the page by "check"
    Then the node "demo" is a match
    And the node "demo" lights "check"
    And the node "demo" lights "check" inside its code span
    When I filter the page by "spec"
    Then the node "order" is a match
    And the node "order" lights "spec"
    And the node "order" lights "spec" inside its link
    And the title of "order" links to "https://example.com/spec#home"
    And the title of "order" styles no tags
    And the title of "kitchen" styles the tag "home"
    And there should be no page errors

  Scenario: A filter lights a phrase that spans an autolink
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"see https://example.com first"}
      """
    When I filter the page by "\"see https\""
    Then the node "demo" is a match
    And the node "demo" lights "see  https"
    And there should be no page errors

  Scenario: A filter lights a phrase that spans code and bold
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"run `just check` before pushing","desc":"check before"}
      {"id":"bold","parent":"kitchen","ord":"a1","title":"check **before** pushing","desc":"check before"}
      """
    When I filter the page by "\"check before\""
    Then the node "demo" is a match
    And the node "demo" lights "check  before"
    And the node "demo" lights "check" inside its code span
    And the node "bold" is a match
    And the node "bold" lights "check  before"
    And there should be no page errors

  Scenario: A search row lights a phrase across rendered pieces
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"run `just check` before pushing","desc":"check before"}
      {"id":"bold","parent":"kitchen","ord":"a1","title":"check **before** pushing","desc":"check before"}
      """
    When I press the palette shortcut
    And I type "\"check before\"" into the palette
    Then the palette item for node "demo" lights "check  before"
    And the palette item for node "demo" is a button with no nested link
    And the palette item for node "bold" lights "check  before"
    And there should be no page errors

  Scenario: A long title wraps onto more lines instead of being cut off
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"order","parent":"kitchen","ord":"a0","title":"order the new cabinets, after measuring every wall twice, checking the corner by the window for square, confirming the door swing against the fridge, asking the supplier which hinges the carcasses take, and writing all of it down in one place so nobody has to ask again","doing":"2026-08-05","date":"2026-08-10"}
      {"id":"install","parent":"kitchen","ord":"a1","title":"install the cabinets","after":["order"]}
      """
    Then the node "order" has the title "order the new cabinets, after measuring every wall twice, checking the corner by the window for square, confirming the door swing against the fridge, asking the supplier which hinges the carcasses take, and writing all of it down in one place so nobody has to ask again"
    And the title of "order" wraps onto more than one line, cut off nowhere
    And the bullet of "order" sits beside the first line of its title
    And the title of "install" is one line
    And the bullet of "install" sits beside the first line of its title
    And there should be no page errors

  @phone
  Scenario: A phone gives a long title the width of its line
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"order","parent":"kitchen","ord":"a0","title":"order the new cabinets, after measuring every wall twice and checking the corner by the window for square","doing":"2026-08-05","date":"2026-08-10"}
      """
    Then the title of "order" wraps onto more than one line, cut off nowhere
    And the title of "order" takes most of the width of its row
    And the bullet of "order" sits beside the first line of its title
    And there should be no page errors
