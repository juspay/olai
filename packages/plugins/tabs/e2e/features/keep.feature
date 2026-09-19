@node-idle-fast @scratch:chat
Feature: Open tabs keep their live conversations awake
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    Then the node agent's fold is ready
    And the agent "install" stands "idle"

  Scenario: An unfolded conversation stays live in the background until its last tab closes
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    Then tab 1 is in front
    And the agent "install" remains "idle" across two idle deadlines
    When I close tab 0 with its button
    Then the agent "install" stands "asleep"
    And there should be no page errors

  Scenario: A node's own page in a background tab keeps its conversation live
    When I follow the agent's open-page link
    Then the node page conversation is ready for "install"
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    Then the agent "install" remains "idle" across two idle deadlines
    When I close tab 0 with its button
    Then the agent "install" stands "asleep"
    And there should be no page errors

  Scenario: Folding releases the hold even while the outline's tab stays open
    When I fold node agent "install"
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    Then the agent "install" stands "asleep"
    When I reload the page
    Then tab 1 is in front
    And the agent "install" remains "asleep" across two idle deadlines
    And there should be no page errors

  Scenario: Restored unfolded background tabs do not wake agents after a server restart
    When I ask the agent "remember this background conversation"
    Then the agent has answered "remember this background conversation" exactly once
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And I mark the page
    And the server stops
    And the server starts again on the same port
    Then the server rejected the stale tab
    And the connection is "retired"
    And the page has not reloaded
    When I reload from the overlay
    Then tab 1 is in front
    And the agent "install" stands "asleep"
    And the agent "install" remains "asleep" across two idle deadlines
    When I press tab 0
    Then the node agent's fold is ready
    And the agent has answered "remember this background conversation" exactly once
    # Stopping the server can log Chromium WebSocket refusals, as in the
    # existing connection restart scenario; the lifecycle assertions above
    # remain the contract here.

  Scenario: Withdrawing tabs releases background holds and reconnecting does not wake them
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    Then the agent "install" remains "idle" across two idle deadlines
    When I open the plugins panel
    And I switch the plugin "tabs" off
    And I close the plugins panel
    Then the agent "install" stands "asleep"
    When I open the plugins panel
    And I switch the plugin "tabs" on
    And I close the plugins panel
    Then there are 2 tabs
    And the agent "install" remains "asleep" across two idle deadlines
    And there should be no page errors

  Scenario: A background split holds its node page even when the outline conversation is folded
    When I fold node agent "install"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    And the node page conversation is ready for "install"
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    Then the agent "install" remains "idle" across two idle deadlines
    When I close tab 0 with its button
    Then the agent "install" stands "asleep"
    And there should be no page errors

  Scenario: Closing one of two matching background tabs preserves the remaining hold
    When I choose "Duplicate tab" from the menu of tab 0
    Then there are 2 tabs
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 2
    And I close tab 0 with its button
    Then the agent "install" remains "idle" across two idle deadlines
    When I close tab 0 with its button
    Then the agent "install" stands "asleep"
    And there should be no page errors


  Scenario: Invisible background tabs release holds on a phone while the front conversation stays live
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And I shrink the window to a phone
    Then there is no tab strip
    And the agent "install" stands "asleep"
    And the agent "install" remains "asleep" across two idle deadlines
    When I widen the window to a desk
    Then the agent "install" remains "asleep" across two idle deadlines
    When I press tab 0
    Then the node agent's fold is ready
    When I shrink the window to a phone
    Then there is no tab strip
    And the agent "install" remains "idle" across two idle deadlines
    And there should be no page errors

  Scenario: Confirmed Fresh Start moves the hold of an already-background tab to the new conversation
    When I remember this conversation as "before fresh"
    And I choose "Duplicate tab" from the menu of tab 0
    Then tab 1 is in front
    When I request a fresh session without confirming
    And I confirm the fresh session
    Then the panel has a different conversation from "before fresh"
    When I remember this conversation as "after fresh"
    And I ask the agent "keep this replacement awake"
    Then the agent has answered "keep this replacement awake" exactly once
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 2
    And I close tab 1 with its button
    Then the agent "install" remains "idle" across two idle deadlines
    When I press tab 0
    Then the node agent's fold is ready
    And the panel is in the remembered conversation "after fresh"
    And the agent has answered "keep this replacement awake" exactly once
    When I close tab 0 with its button
    Then the agent "install" stands "asleep"
    And there should be no page errors
