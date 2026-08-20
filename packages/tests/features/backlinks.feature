@share-scratch
@scratch:good
Feature: Referenced by — a zoomed node says what points at it
  Every reference in this format points ONE way on disk. `order` writes
  `see: ["herbs"]`, or a note writes `@herbs`, and the herb bed's own record
  says nothing about either — so until this section existed, finding what talked
  about a node meant searching for its id by hand.

  So a zoomed node draws the reverse: a `Referenced by …` section under its
  heading, shut by default, holding two rows — what SEES this node, and what
  MENTIONS it by its `@id` (the spelling #228 taught the chat). Both are
  derived, so both follow the disk with nothing reloaded, and each entry opens
  the record that made the reference.

  What is deliberately NOT in it is as much of the feature as what is:

    - a MIRROR is a placement, which is a second view of a node rather than a
      claim about it — and `read_node`'s `mirrors` already answers where else a
      node is drawn;
    - an `after` or a `blocks` is the ordering graph, and both directions of it
      are already on the page (`blocked by`, and the node's own `after` row);
    - a referrer written in an `_olai/Trash.olai` is left out, as it is everywhere
      else (#226).

  `@scratch:` because the live scenarios write the directory they are served.
  They share one copy per worker (`@share-scratch`); the corpus is restored
  between scenarios.

  Background:
    Given I open the node "herbs"
    And I mark the page

  # ── what it says, and how it starts ──────────────────────────────────

  Scenario: A node that is pointed at says so, and starts shut
    # `order` (house.olai) sees `herbs` (garden.olai), which is the one `see` in
    # this corpus and the only thing that counts here.
    Then the page says it is referenced by 1 nodes
    And the referenced-by section is collapsed
    When I open the referenced-by section
    Then the referenced-by "sees this" row reads "order the new cabinets"
    # No note in this corpus names the herb bed, so the second row is absent
    # rather than empty — the rule every relation row on this page follows.
    And the referenced-by section draws no "mentions this" row
    And there should be no page errors

  Scenario: Each entry opens the record that made the reference
    When I open the referenced-by section
    And I follow the referenced-by link to "order"
    Then the zoomed node is "order"
    And there should be no page errors

  # ── the three rulings ────────────────────────────────────────────────

  Scenario: A placement is not a reference
    # `kitchen-herbs` (house.olai) mirrors `herbs`, and zooming the placement
    # lands on the one page the herb bed has — where the mirror is NOT among the
    # things referring to it. A view is not a claim.
    Given I open the node "kitchen-herbs"
    Then the zoomed node is "herbs"
    And the page says it is referenced by 1 nodes
    When I open the referenced-by section
    Then the referenced-by "sees this" row reads "order the new cabinets"
    And there should be no page errors

  Scenario: What is put away is on the Trash and nowhere else
    When I rewrite "_olai/Trash.olai" as:
      """
      {"id":"retired","ord":"a0","title":"the old bed, see @herbs","see":["herbs"]}
      """
    And another writer adds "look at @herbs before Tuesday" to "garden.olai"
    # The archived record does BOTH things this section draws, and neither
    # reaches the page: what arrives is the live mention, so the count is two
    # rather than three and each row holds exactly the live half.
    Then the page says it is referenced by 2 nodes
    When I open the referenced-by section
    Then the referenced-by "sees this" row reads "order the new cabinets"
    And the referenced-by "mentions this" row reads "look at @herbs before Tuesday"
    And the page has not reloaded
    And there should be no page errors

  # ── live, which is the whole of "derived" ────────────────────────────

  Scenario: A reference written elsewhere arrives while the section is open
    When I open the referenced-by section
    And another writer adds "look at @herbs before Tuesday" to "garden.olai"
    Then the page says it is referenced by 2 nodes
    # The section a reader opened stays open when the set moves under it — the
    # list grows in place rather than shutting and starting again.
    And the referenced-by section is still open
    And the referenced-by "mentions this" row reads "look at @herbs before Tuesday"
    And the referenced-by "sees this" row reads "order the new cabinets"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A word taken back out takes its entry with it
    When another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And the page says it is referenced by 2 nodes
    And I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"outsider","ord":"z0","title":"look at nothing in particular"}
      """
    Then the page says it is referenced by 1 nodes
    And the page has not reloaded
    And there should be no page errors

  Scenario: The last reference going takes the whole section with it
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets"}
      """
    Then the page draws no referenced-by section
    And the page has not reloaded
    And there should be no page errors

  Scenario: One record doing both is one referrer, in both rows
    When another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets for @herbs","see":["herbs"]}
      """
    # THREE would be counting links; the count is the records that refer, and
    # `order` is one record saying two things.
    Then the page says it is referenced by 2 nodes
    When I open the referenced-by section
    Then the referenced-by "sees this" row reads "order the new cabinets for @herbs"
    # CORPUS ORDER, whichever index found them: garden.olai sorts before
    # house.olai, so the appended mention comes first even though the `see`
    # was there all along.
    And the referenced-by "mentions this" row reads "look at @herbs before Tuesday, order the new cabinets for @herbs"
    And there should be no page errors
