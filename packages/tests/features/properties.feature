@scratch:good
Feature: Properties on a node, from the web
  A property is a named fact on a node — `pr`, `agent`, `isbn` — kept in the
  same map olai keeps a node's status and date in (docs/format.md). An agent
  writes one with `set_prop`; this is the person's door onto the same op.

  The drawer under a node's note is where they are read: one `key value` line
  each, and nothing at all on a node that carries none. The `•••` menu is where
  they are written — add one, change what one holds, take one off — and each of
  those is one edit at the same write gate the keys and the agent's tools go
  through, so nothing is echoed: the drawer changes when the file says it
  changed.

  `@scratch:` because these write the directory they are served — each
  scenario gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A node that says nothing about itself has no drawer
    # Not an empty drawer, and not a heading with nothing under it: a vault
    # where nobody has written a property looks exactly as it did before there
    # were any.
    Then the node "handles" shows no properties

  Scenario: Adding one writes it, and the drawer says so
    When I open the node menu of "handles"
    Then the node menu offers "Add property…"
    When I choose "Add property…" from the node menu
    Then the property editor is open
    And the property editor holds "" and ""
    # ...and the menu says NOTHING: an entry answers with what it has to say,
    # and opening a panel has nothing to say.
    And the node menu of "handles" says nothing
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/176"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/176"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/176"
    And the property editor is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: A property it carries is offered for editing, with what it holds
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "handles" shows the property "stage" holding "review"
    When I open the node menu of "handles"
    Then the node menu offers "Edit stage…"
    When I choose "Edit stage…" from the node menu
    Then the property editor holds "stage" and "review"
    # A rename is a removal and an addition — two ops, which is exactly the two
    # calls an agent makes — so the key is not something this panel can type in.
    And the property editor's key is fixed
    When I write the property "stage" holding "addressing"
    Then the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And there should be no page errors

  Scenario: Removing one is a menu entry and takes the key off
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "handles" shows the property "stage" holding "review"
    When I open the node menu of "handles"
    Then the node menu offers "Remove stage"
    When I choose "Remove stage" from the node menu
    Then the node "handles" shows no property "stage"
    And "house.olai" holds the node "handles" with no "stage"
    # The node is back to saying nothing about itself, and the drawer goes with
    # the last line rather than staying as an empty box.
    And the node "handles" shows no properties
    And there should be no page errors

  Scenario: Leaving the editor writes nothing
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I leave the property editor
    Then the property editor is closed
    And the node "handles" shows no properties
    And there should be no page errors

  Scenario: The keys olai reads are not in the drawer, and not in the menu
    # `order` carries `status`, `since`, `date`, `after` and `see` — every one
    # of them already drawn by the control that knows what it means, and every
    # one of them refused by `set_prop` toward the verb that owns it. What the
    # drawer shows is exactly what it can change.
    Then the node "order" shows no properties
    When I open the node menu of "order"
    Then the node menu does not offer "Edit date…"
    And the node menu does not offer "Remove status"
    And the node menu offers "Change date…"
