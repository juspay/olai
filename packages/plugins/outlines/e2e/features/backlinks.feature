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
      claim about it — and `outlines_read`'s `mirrors` already answers where else a
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

  Scenario: A node that is pointed at says so, and starts shut
    Then the page says it is referenced by 1 things
    And the referenced-by section is collapsed
    When I open the referenced-by section
    Then the referenced-by "Sees this" row reads "order the new cabinets"
    And the referenced-by section draws no "Mentions this" row
    And there should be no page errors

  Scenario: Each entry opens the record that made the reference
    When I open the referenced-by section
    And I follow the referenced-by link to "order"
    Then the unified destination row "order" is selected
    And there should be no page errors

  Scenario: A placement is not a reference
    Given I open the node "kitchen-herbs"
    Then the zoomed node is "herbs"
    And the page says it is referenced by 1 things
    When I open the referenced-by section
    Then the referenced-by "Sees this" row reads "order the new cabinets"
    And there should be no page errors

  Scenario: What is put away is on the Trash and nowhere else
    When I rewrite "_olai/Trash.olai" as:
      """
      {"id":"retired","ord":"a0","title":"the old bed, see @herbs","see":["herbs"]}
      """
    And another writer adds "look at @herbs before Tuesday" to "garden.olai"
    Then the page says it is referenced by 2 things
    When I open the referenced-by section
    Then the referenced-by "Sees this" row reads "order the new cabinets"
    And the referenced-by "Mentions this" row reads "look at @herbs before Tuesday"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A reference written elsewhere arrives while the section is open
    When I open the referenced-by section
    And another writer adds "look at @herbs before Tuesday" to "garden.olai"
    Then the page says it is referenced by 2 things
    And the referenced-by section is still open
    And the referenced-by "Mentions this" row reads "look at @herbs before Tuesday"
    And the referenced-by "Sees this" row reads "order the new cabinets"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A word taken back out takes its entry with it
    When another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And the page says it is referenced by 2 things
    And I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"outsider","ord":"z0","title":"look at nothing in particular"}
      """
    Then the page says it is referenced by 1 things
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
    Then the page says it is referenced by 2 things
    When I open the referenced-by section
    Then the referenced-by "Sees this" row reads "order the new cabinets for @herbs"
    And the referenced-by "Mentions this" row reads "look at @herbs before Tuesday, order the new cabinets for @herbs"
    And there should be no page errors

  Scenario: A body's @mention reaches a node's page, and leaves when the prose drops it
    Given I open the node "basil"
    When I rewrite "finishes.md" as:
      """
      # Finishes

      the herb bed is @basil
      """
    Then the page says it is referenced by 1 things
    When I open the referenced-by section
    Then the referenced-by "Mentions this" row reads "Finishes"
    When I rewrite "finishes.md" as:
      """
      # Finishes

      the herb bed is over there
      """
    Then the page draws no referenced-by section
    And the page has not reloaded
    And there should be no page errors

  Scenario: A body's link to a node draws under "Links to this"
    Given I open the node "basil"
    When I rewrite "finishes.md" as:
      """
      # Finishes

      [the herb bed](#basil)
      """
    Then the page says it is referenced by 1 things
    When I open the referenced-by section
    Then the referenced-by section draws no "Mentions this" row
    And the referenced-by "Links to this" row reads "Finishes"
    And there should be no page errors

  Scenario: A link inside a code fence is text, not a reference
    Given I open the node "basil"
    When I rewrite "finishes.md" as:
      """
      # Finishes

      ```md
      [the herb bed](#basil)
      ```

      the herb bed is @basil
      """
    Then the page says it is referenced by 1 things
    When I open the referenced-by section
    Then the referenced-by section draws no "Links to this" row
    And the referenced-by "Mentions this" row reads "Finishes"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A record note can link a node, and draws under "Links to this"
    Given I open the node "basil"
    When I rewrite "notes.olai" as:
      """
      {"id":"sowing-notes","ord":"a0","title":"sowing notes"}
      {"id":"sow-basil","parent":"sowing-notes","ord":"a0","title":"sow the basil","desc":"[basil](#basil)"}
      """
    Then the page says it is referenced by 1 things
    When I open the referenced-by section
    Then the referenced-by "Links to this" row reads "sow the basil"
    When I follow the referenced-by link to "sow-basil"
    Then the unified destination row "sow-basil" is selected
    And the focused pane is drawing the outline "notes.olai"
    And there should be no page errors
