@scratch:good
Feature: Held drags remain safe when their source or destination disappears
  Scenario: Escape ends a selection sweep while retaining its picked rows until a second Escape
    Given I open the outline "house.olai"
    And I show the done nodes
    When I sweep from beside "demo" down to "install"
    Then the band is crossing 3 rows
    And 3 rows are picked
    When I press "Escape"
    Then no band is drawn
    And 3 rows are picked
    When I let go
    Then no band is drawn
    And 3 rows are picked
    When I press "Escape"
    Then no rows are picked
    When I sweep from beside "demo" down to "install"
    Then the band is crossing 3 rows
    When I let go
    Then no band is drawn
    And 3 rows are picked
    And there should be no page errors

  Scenario: Escape cancels a held drag before release and a later drag still works
    Given I rewrite "drag-recovery.olai" as:
      """
      {"id":"drag-source","ord":"a0","title":"Source row"}
      {"id":"drag-parent","ord":"a1","title":"Destination parent"}
      {"id":"drag-anchor","parent":"drag-parent","ord":"a0","title":"Destination child"}
      """
    And I open the outline "drag-recovery.olai"
    And I mark the page
    When I pick up the bullet of "drag-source" and hold it above the title of "drag-anchor"
    Then the drop line would put it under "drag-parent"
    When I press "Escape"
    Then no drop line is shown
    When I let go
    Then the node "drag-source" is not a child of "drag-parent"
    And the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    When I drag the bullet of "drag-source" above the title of "drag-anchor"
    Then the node "drag-source" is a child of "drag-parent"
    When I press "ControlOrMeta+z"
    Then the node "drag-source" is not a child of "drag-parent"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Removing the dragged row makes release harmless and a restored row can be dragged again
    Given I rewrite "drag-recovery.olai" as:
      """
      {"id":"drag-source","ord":"a0","title":"Source row"}
      {"id":"drag-parent","ord":"a1","title":"Destination parent"}
      {"id":"drag-anchor","parent":"drag-parent","ord":"a0","title":"Destination child"}
      """
    And I open the outline "drag-recovery.olai"
    And I mark the page
    When I remember the served bytes of "drag-recovery.olai"
    And I pick up the bullet of "drag-source" and hold it above the title of "drag-anchor"
    Then the drop line would put it under "drag-parent"
    When I rewrite "drag-recovery.olai" as:
      """
      {"id":"drag-parent","ord":"a1","title":"Destination parent"}
      {"id":"drag-anchor","parent":"drag-parent","ord":"a0","title":"Destination child"}
      """
    Then the node "drag-source" is not shown
    When I let go
    Then the outline "drag-recovery.olai" shows exactly the nodes "drag-parent, drag-anchor"
    When I restore the remembered served bytes of "drag-recovery.olai"
    Then the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    When I drag the bullet of "drag-source" above the title of "drag-anchor"
    Then the node "drag-source" is a child of "drag-parent"
    When I press "ControlOrMeta+z"
    Then the node "drag-source" is not a child of "drag-parent"
    And the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A plugin rebuild cancels the held gesture and leaves a fresh drag usable
    Given I rewrite "drag-recovery.olai" as:
      """
      {"id":"drag-source","ord":"a0","title":"Source row"}
      {"id":"drag-parent","ord":"a1","title":"Destination parent"}
      {"id":"drag-anchor","parent":"drag-parent","ord":"a0","title":"Destination child"}
      """
    And I open the outline "drag-recovery.olai"
    And I mark the page
    When I pick up the bullet of "drag-source" and hold it above the title of "drag-anchor"
    Then the drop line would put it under "drag-parent"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    When I let go
    Then the node "drag-source" is not a child of "drag-parent"
    And the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    When I drag the bullet of "drag-source" above the title of "drag-anchor"
    Then the node "drag-source" is a child of "drag-parent"
    When I press "ControlOrMeta+z"
    Then the node "drag-source" is not a child of "drag-parent"
    And the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Removing the destination branch prevents a stale drop and restoration permits a new drag
    Given I rewrite "drag-recovery.olai" as:
      """
      {"id":"drag-source","ord":"a0","title":"Source row"}
      {"id":"drag-parent","ord":"a1","title":"Destination parent"}
      {"id":"drag-anchor","parent":"drag-parent","ord":"a0","title":"Destination child"}
      """
    And I open the outline "drag-recovery.olai"
    And I mark the page
    When I remember the served bytes of "drag-recovery.olai"
    And I pick up the bullet of "drag-source" and hold it above the title of "drag-anchor"
    Then the drop line would put it under "drag-parent"
    When I rewrite "drag-recovery.olai" as:
      """
      {"id":"drag-source","ord":"a0","title":"Source row"}
      """
    Then the node "drag-anchor" is not shown
    When I let go
    Then the outline "drag-recovery.olai" shows exactly the nodes "drag-source"
    When I restore the remembered served bytes of "drag-recovery.olai"
    Then the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    When I drag the bullet of "drag-source" above the title of "drag-anchor"
    Then the node "drag-source" is a child of "drag-parent"
    When I press "ControlOrMeta+z"
    Then the node "drag-source" is not a child of "drag-parent"
    And the outline "drag-recovery.olai" shows exactly the nodes "drag-source, drag-parent, drag-anchor"
    And the page has not reloaded
    And there should be no page errors
