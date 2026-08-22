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

  Scenario: A title nests one emphasis inside the other, and a filter lights inside it
    # `plain-estimate-nested-emphasis`. The renderer never had this bug — the
    # CHECK above it did: a title is drawn as its own escaped source when the
    # pipeline lost words the source still accounts for, and "accounts for"
    # was measured with regexes that could not read `**b *c* d**`. A perfect
    # rendering was thrown away, marks and all, and the escaped source lights
    # nothing — so a row the filter had selected drew no reason for being in
    # front of anybody. Both halves are here, on one page.
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
    # The dark corner of `filter_in_place.feature`'s "every row says why it is
    # drawn": these rows were already SELECTED — the matcher reads a title as
    # the text somebody typed, backticks and brackets and all — and they drew
    # nothing lit, because the highlight rode the walk that deliberately does
    # not re-read code or a link for `#tags` and turned back at the same door.
    # The tag rule is a rule about tags; the highlight goes everywhere.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"run `just check` before pushing"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"see the [cabinet spec](https://example.com/spec#home) first"}
      """
    # 1. INSIDE THE CODE SPAN — and inside it, not merely somewhere in the row.
    When I filter the page by "check"
    Then the node "demo" is a match
    And the node "demo" lights "check"
    And the node "demo" lights "check" inside its code span
    # 2. INSIDE THE LINK'S TEXT, which stays a link: a highlight is drawn in
    #    text and never in an attribute.
    When I filter the page by "spec"
    Then the node "order" is a match
    And the node "order" lights "spec"
    And the node "order" lights "spec" inside its link
    And the title of "order" links to "https://example.com/spec#home"
    # 3. AND THE PROTECTION THE WALK WAS TURNING BACK FOR IS UNTOUCHED: the
    #    `#home` in that URL fragment is not a tag, the `#home` in the row above
    #    it is — one page, both readings, which is the whole point of the rule
    #    being about tags rather than about where the walk may go.
    And the title of "order" styles no tags
    And the title of "kitchen" styles the tag "home"
    And there should be no page errors

  Scenario: A filter lights a phrase that spans an autolink
    # Matching-faithful: "see https" is a substring of the SOURCE, so the row
    # is selected on the title. HAST still splits the URL into its own text
    # node; both pieces of the phrase must light. The extra space in the
    # asserted string is join(" ") plus a piece that already starts with one.
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
    # Matching is the SOURCE: a quoted "check before" is not in
    # `run \`just check\` before pushing` (a backtick sits between the words),
    # so the phrase is also in desc so the row is in front of you. The
    # highlight is the visible title. The unit test is the renderer pin;
    # this scenario is the page.
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
    # The palette draws the same renderTitle a tree row does (links: false,
    # because the row is a button). Do not locate by visible label: CODE's
    # rendered text contains the bold title. data-id is hit-#demo / hit-#bold.
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
