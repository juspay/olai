Feature: An agent is offered only where one can start
  Chat offers an agent in three places: the `+` on the sidebar's Chats heading,
  the start pill on a row, and `Start an agent` on a row's `•••`. Each lists
  only the agents this machine can start — an agent it lacks is explained in
  the plugins panel, not drawn as a row nobody can pick. With exactly one
  agent there is nothing to choose, so the gesture starts it; with none, the
  `+` says so and points at the plugins panel. A row's standing is a fact
  about the row and is always drawn; the start pill is an offer and follows
  what can start.

  # ── the Chats + ──────────────────────────────────────────────────────

  @codex @scratch:chat
  Scenario: With several agents the Chats + lists only those that can start
    Given I open the outline "house.olai"
    When I press new chat in Chats
    Then the agent menu offers exactly "Claude Code|Codex"
    When I press "Escape"
    Then the agent menu is shut
    And the Inbox contains no chat children

  @no-agent @scratch:chat
  Scenario: With no agent the Chats + says so and opens the plugins panel
    Given I open the outline "house.olai"
    When I press new chat in Chats
    Then the agent menu says no agent is set up
    And the agent menu offers to open plugins
    When I choose Open plugins in the agent menu
    Then the agent menu is shut
    And the plugins panel is open
    And the Inbox contains no chat children
    And there should be no page errors

  @no-agent @rows-off:plugin-inspector @scratch:chat
  Scenario: Without the plugin inspector there is no plugins door to offer
    Given I open the outline "house.olai"
    When I press new chat in Chats
    Then the agent menu says no agent is set up
    And the agent menu does not offer to open plugins
    And there should be no page errors

  # ── a row's •••: Start an agent ─────────────────────────────────────

  @scratch:chat
  Scenario: With one agent, Start an agent is a plain entry that starts it
    Given I open the outline "house.olai"
    When I open the node menu of "order"
    Then chat's "Start an agent" in the node menu runs at once
    When I choose "Start an agent" from the node menu
    Then node agent "order" is unfolded
    And the header names the agent "claude"

  @codex @scratch:chat
  Scenario: With several agents, Start an agent opens a submenu of them
    Given I open the outline "house.olai"
    When I open the node menu of "order"
    Then chat's "Start an agent" in the node menu opens a submenu
    When I open the node menu's "Start an agent" agents
    Then the node menu's "Start an agent" offers the agents "Claude Code|Codex"
    When I pick "Codex" in the "Start an agent" submenu of the node menu
    Then node agent "order" is unfolded
    And the header names the agent "codex"
    And there should be no page errors

  @codex @scratch:chat
  Scenario: The agent submenu is reached and chosen from the keyboard
    Given I open the outline "house.olai"
    When I open the node menu of "order" with the keyboard
    And I open the node menu's "Start an agent" agents with the keyboard
    Then the node menu's "Start an agent" offers the agents "Claude Code|Codex"
    When I press "ArrowDown"
    And I press Enter on "Codex" in the node menu's agents
    Then node agent "order" is unfolded
    And the header names the agent "codex"

  @no-agent @scratch:chat
  Scenario: With no agent the row menu offers no Start an agent
    Given I open the outline "house.olai"
    When I open the node menu of "order"
    Then the node menu does not offer "Start an agent"

  # ── availability is live ─────────────────────────────────────────────

  @codex @scratch:chat
  Scenario: An agent switched off leaves every menu, and returns when switched on
    Given I open the outline "house.olai"
    When I open the plugins panel
    And I switch the plugin "codex" off
    And I press "Escape"
    And I open the node menu of "order"
    Then chat's "Start an agent" in the node menu runs at once
    When I press "Escape"
    And I press new chat in Chats
    # One agent left: the + starts it rather than asking.
    Then the new Inbox conversation is unfolded as "new-chat" with engine "claude"
    When I open the plugins panel
    And I switch the plugin "codex" on
    And I press "Escape"
    # The new chat took this tab to the Inbox; the row menu is read back on
    # the outline it started from.
    And I open the outline "house.olai"
    And I open the node menu of "order"
    Then chat's "Start an agent" in the node menu opens a submenu
    When I open the node menu's "Start an agent" agents
    Then the node menu's "Start an agent" offers the agents "Claude Code|Codex"
    And there should be no page errors

  @scratch:chat
  Scenario: Chat switched off withdraws every agent entry and button
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    When I open the plugins panel
    And I switch the plugin "chat" off
    And I press "Escape"
    Then no agent control is drawn anywhere
    When I open the node menu of "order"
    Then the node menu does not offer "Start an agent"
    When I press "Escape"
    And I open the node menu of "install"
    Then the node menu does not offer "Fresh start"
    And the node menu does not offer "Close the agent"
    When I press "Escape"
    And I open the plugins panel
    And I switch the plugin "chat" on
    And I press "Escape"
    Then agent controls are drawn again
    And there should be no page errors

  # ── standings are facts, offers wait ────────────────────────────────

  @no-agent @corpus:lanes
  Scenario: A row with an agent shows its standing even when no agent can start
    Given I open the outline "lanes.olai"
    Then the agent standing on "door-live" is shown
    And the agent standing on "door-implement" is shown
    And the agent start pill on "lane-fresh" is absent

  @phone @scratch:chat
  Scenario: On a phone the start offer waits for the tapped row
    Given I open the outline "house.olai"
    Then the agent start pill on "order" is not shown
    And the agent start pill on "install" is not shown
    When I click the title of "order"
    Then the agent start pill on "order" is visible
    And the agent start pill on "install" is not shown
