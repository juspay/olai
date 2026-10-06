@scratch:good @share-scratch
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

  Background:
    Given the ledger fixtures are served

  Scenario: A node's link to a ledger draws no card
    # A node whose note links the ledger, opened on the node's own page — the
    # precedent `link_preview.feature` sets, and the same door this claim needs:
    # a note's links are the markdown an ordinary reader writes.
    Given I rewrite "pointer.olai" as:
      """
      {"id":"ptr","ord":"a0","title":"Pointer","desc":"[the ledger](money/household.journal)"}
      """
    When I open the node "ptr"
    And I hover the preview link "the ledger"
    Then the link preview stays closed
    And there should be no page errors
