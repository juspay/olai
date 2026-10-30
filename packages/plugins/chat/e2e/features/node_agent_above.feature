@scratch:chat
Feature: One press up to the closest node agent
  A node that sits under a node agent says so — in the head of its page, at the
  end of its agent line and on the crumb of every bound ancestor — and each of
  those is the same door: the ancestor's own conversation page.

  Scenario: An unbound node's page names the closest agent above and opens it
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I zoom into the node "hinges"
    Then the agent-above pill points at "install"
    And the agent-above pill reads "install the cabinets" and "Claude Code"
    When I press the agent-above pill
    Then the page is the agent "install"
    And the node page conversation is ready for "install"
    And there should be no page errors

  Scenario: A day row's ancestor crumb is the same door
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","date":"2026-08-02"}
      {"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges","desc":"brass, if the budget survives"}
      {"id":"chase-supplier","parent":"install","ord":"a1","title":"chase the supplier"}
      {"id":"chase-tiler","parent":"kitchen","ord":"a3","title":"chase the supplier"}
      """
    And I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I open the day "2026-08-02"
    Then the day lists "install"
    And the crumb on "kitchen" wears the agent's mark
    When I press the crumb mark on "kitchen"
    Then the page is the agent "kitchen"
    And the node page conversation is ready for "kitchen"
    And there should be no page errors

  Scenario: A search hit's ancestor crumb is the same door
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I press the palette shortcut
    And I type "pick the hinges" into the palette
    Then the search hit "pick the hinges" wears the mark of "install"
    When I press the crumb mark on "install" in the search hit "pick the hinges"
    Then the command palette is closed
    And the page is the agent "install"
    And the node page conversation is ready for "install"
    And there should be no page errors

  Scenario: Two bound ancestors mark their crumbs; the pill names only the closest
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I zoom into the node "hinges"
    Then the agent-above pill points at "install"
    And the crumb on "kitchen" wears the agent's mark
    And the crumb on "install" wears the agent's mark
    And there should be no page errors

  Scenario: A bound node's own line wears the pill, on the page and in the panel
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the "claude" agent on node "hinges"
    And the node agent's fold is ready
    And I zoom into the node "hinges"
    Then the node page conversation is ready for "hinges"
    And the agent page's line wears the agent-above pill
    And the agent-above pill points at "install"
    When I open this conversation in the panel from its agent line
    Then the agent panel's conversation is ready
    And the agent panel's agent-above pill points at "install"
    And there should be no page errors

  Scenario: Stopping an ancestor retargets the pill in place; stopping the last empties it
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I alt-click the zoom of "hinges"
    Then pane 1 shows the node page "hinges"
    And the agent-above pill points at "install"
    When I open the node menu of "install"
    And I choose "Close the agent" from the node menu
    Then the agent-above pill points at "kitchen"
    When I open the node menu of "kitchen"
    And I choose "Close the agent" from the node menu
    Then the agent-above pill is absent
    And the page head is empty
    And there should be no page errors

  Scenario: The row menu opens the agent above
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I open the node menu of "hinges"
    Then the node menu offers "Open the agent above"
    When I choose "Open the agent above" from the node menu
    Then the page is the agent "install"
    And the node page conversation is ready for "install"
    And there should be no page errors

  Scenario: The palette opens the agent above for the zoomed node
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I zoom into the node "hinges"
    And I press the palette shortcut
    And I type "open the agent above" into the palette
    Then the palette lists the row "open-agent-above"
    When I press the palette row "open-agent-above"
    Then the page is the agent "install"
    And the node page conversation is ready for "install"
    And there should be no page errors

  Scenario: Nothing bound above leaves the page head empty and the menus silent
    Given I open the outline "house.olai"
    When I open the node menu of "hinges"
    Then the node menu does not offer "Open the agent above"
    When I click away from the node menu
    And I zoom into the node "hinges"
    Then the agent-above pill is absent
    And the page head is empty
    And no crumb wears an agent mark
    When I press the palette shortcut
    And I type "open the agent above" into the palette
    Then the palette lists no row "open-agent-above"
    And there should be no page errors
