@share-scratch
Feature: A link to a ledger is a link
  A ledger has a page, so a note or a node that links to one navigates there —
  the same rewrite every other kind with a page gets. What it does NOT get is a
  hover card: the preview card is contributed per KIND (`olai-plugin-markdown`
  for a document, `olai-plugin-outlines` for a node, chat for an agent), and a
  journal is none of those. So a link to a ledger is an ordinary link, exactly
  as a link to a `.csv` is.

  This is pinned because the mistake it guards is a real one and invisible
  from the ledger's own page: a matcher widened from "this kind" to "any kind
  that holds text" would draw a ledger's link with the MARKDOWN body renderer —
  a card whose content is parsed by the wrong reader. The absence is the
  promise.

  @scratch:good
  Scenario: A node's link to a ledger opens the page and draws no card
    Given I rewrite "money/pointer.olai" as:
      """
      {"id":"ptr","ord":"a0","title":"Pointer","desc":"[the ledger](household.journal)"}
      """
    When I open the outline "money/pointer.olai"
    # The link is a node's own `[the ledger](household.journal)`. Nothing is
    # drawn over it, over the delay a card takes to appear.
    And I hover the preview link "the ledger"
    Then the link preview stays closed
    And there should be no page errors
