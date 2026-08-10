@corpus:good
Feature: See the outline
  Opening an outline shows its tree. Almost everything on screen is DERIVED
  rather than stored — a parent's status, the tags inside a title, the subtree
  a mirror stands for — so these scenarios are as much about the derivation
  being right as about the pixels: `kitchen` says nothing about itself on disk,
  and the view has to work out that it is `doing` from its three children.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: The tree shows the outline's nodes
    Then the tree is shown
    And the node "kitchen" is shown
    And the node "demo" is a child of "kitchen"
    And the node "handles" is a child of "install"

  Scenario: A node shows its title
    Then the node "kitchen" has the title "kitchen remodel #home"

  Scenario: A leaf shows the status it stores
    Then the node "demo" has status "done"
    And the node "order" has status "doing"
    And the node "handles" has status "open"

  Scenario: Status is a checkbox beside the bullet — including open
    # The racket original drew status as a box, not only as title tone. All
    # three states render a box: checked for done, half for doing, and an EMPTY
    # box for open — the open state is not the absence of a checkbox.
    Then the node "demo" shows a checked checkbox
    And the node "order" shows a doing checkbox
    And the node "handles" shows an empty checkbox

  Scenario: A parent shows the status derived from its children
    # `kitchen` stores no status at all: one child is done, one is under way,
    # one has not started, so it is `doing`. The mirror under it does not count.
    Then the node "kitchen" has status "doing"

  Scenario: A dated node shows a date badge
    Then the node "order" shows the date "2026-08-10"
    And the node "demo" shows no date

  Scenario: A description is rendered as markdown
    Then the description of "order" renders bold text "walnut"
    And the description of "order" renders 2 list items
    And the description of "order" does not show its markdown source

  Scenario: A hash-tag in a title is styled
    Then the title of "kitchen" styles the tag "home"
    # Styling the tag must not eat it: the title is stored verbatim, `#` and all.
    And the node "kitchen" has the title "kitchen remodel #home"

  Scenario: Collapsing a node hides its children, expanding brings them back
    Given the node "kitchen" is expanded
    And I mark the page
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    When I expand the node "kitchen"
    Then the node "kitchen" is expanded
    And the children of "kitchen" are shown
    And the page has not reloaded

  Scenario: A leaf has nothing to collapse
    Then the node "handles" has no toggle

  Scenario: A mirror shows its target's subtree, inline and marked
    # `kitchen-herbs` lives in house.jsonl and points at `herbs` in
    # garden.jsonl — the one relation that crosses files.
    Then the node "kitchen-herbs" is marked as a mirror
    And the node "basil" is a child of "kitchen-herbs"
    And the node "mint" is a child of "kitchen-herbs"
    And there should be no page errors
