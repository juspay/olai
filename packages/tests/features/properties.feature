@scratch:good
Feature: Properties on a node, from the web
  A property is a named fact on a node — `pr`, `agent`, `isbn` — kept in the
  record's one open field, `custom` (docs/format.md). An agent writes one with
  `set_prop`; this is the person's door onto the same op.

  The drawer under a node's note is where they are read, and it leads with the
  facts the node carries in fields of its own — its id, the mark it has, its
  date — because those had nowhere on the page to be read at all. The `•••`
  menu writes the custom half: add one, change what one holds, take one off.
  Each is one edit at the same write gate the keys and the agent's tools go
  through, so nothing is echoed — the drawer changes when the file says it
  changed.

  `@scratch:` because these write the directory they are served — each
  scenario gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A row draws no drawer until somebody has added a property
    # The node's own facts are not worth an `id` line under every bullet in the
    # vault; a page about one node is where they are always drawn.
    Then the node "handles" shows no drawer

  Scenario: Adding one writes it, and the drawer says so
    When I open the node menu of "handles"
    Then the node menu offers "Add property…"
    When I choose "Add property…" from the node menu
    Then the property editor is open
    And the property editor holds "" and ""
    # ...and the menu says NOTHING: an entry answers with what it has to say,
    # and opening a panel has nothing to say.
    And the node menu of "handles" says nothing
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    And the property editor is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: The drawer leads with the facts the node already carries
    # Once there is a drawer at all, the id is in it — which is the whole reason
    # the system half exists: an id is what every tool call takes and it was
    # readable nowhere on the page.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review"
    Then the node "handles" shows the property "id" holding "handles"
    And the property "id" on "handles" is read-only
    And the node "handles" shows the property "stage" holding "review"

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
    # ...and the row is back to drawing nothing at all, rather than a drawer
    # holding only the facts nobody asked to see.
    And the node "handles" shows no drawer
    And there should be no page errors

  Scenario: Leaving the editor writes nothing
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I leave the property editor
    Then the property editor is closed
    And the node "handles" shows no drawer
    And there should be no page errors

  @phone
  Scenario: The drawer and its editor work with a thumb, at 390 points
    # The `•••` is not drawn on a phone at all — a gutter that wide would leave
    # no room for the title — so the drawer's door here is the same long press
    # every other verb uses (`on_a_phone.feature`). What is new is the panel:
    # two boxes and two buttons in a flex row, which is comfortable at 1200pt
    # and a claim at 390, and the inputs keep the 44px a finger is given while
    # a laptop does not pay for it (`md:min-h-0`).
    When I hold a finger on the node "handles"
    Then the node menu is open
    When I tap "Add property…" in the node menu
    Then the property editor is open
    And the property editor fits the screen
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    And there should be no page errors

  Scenario: The node's own facts have no entries in the menu
    # `order` carries a date, and the entry for it is `Change date…`. An
    # `Edit date…` beside it would be a second spelling of one write — and the
    # one `set_prop` refuses by name.
    When I open the node menu of "order"
    Then the node menu does not offer "Edit date…"
    And the node menu does not offer "Remove date"
    And the node menu does not offer "Remove id"
    And the node menu offers "Change date…"

  Scenario: A search result carries the properties, and says which one answered
    # The scenario PR #192 could not write. It put the whole `custom` map on a
    # hit and deliberately left the row alone, because "should a reader SEE a
    # hit's properties" was a product question nobody had ruled — so there was
    # nothing on screen to assert. It is ruled now, and this is the loop it
    # bought: write a fact on a node, then ask the header box for it and get the
    # fact back on the row, without opening anything.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "agent" holding "claude-opus"
    And I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "pr" holding "https://github.com/juspay/olai/pull/192"
    Then the node "handles" shows the property "agent" holding "claude-opus"

    # The board's own query, asked by a person this time. The row draws both
    # properties — a hit carries the whole map — and marks the one the query
    # named, which leads so a narrow panel ellipsizes the others instead.
    When I search the header for "prop:agent=claude-opus"
    Then the header search lists the node "choose the handles"
    And the header search result "choose the handles" shows the property "agent" holding "claude-opus"
    And the header search result "choose the handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/192"
    And the header search result "choose the handles" marks "agent" as why it matched
    And there should be no page errors

  Scenario: A node carrying no property draws no third line
    # The drawer's rule on a row, kept on a result row for the drawer's own
    # reason: a list of titles must not grow a line to say nothing.
    When I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    And the header search result "order the new cabinets" shows no properties
    And there should be no page errors
