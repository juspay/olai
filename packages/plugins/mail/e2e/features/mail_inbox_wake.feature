@scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
Feature: An agent opts into inbox wakes on its node

  Background:
    Given the harness keeps distinct sessions on disk
    And mail checks the inbox every "200ms"
    And I open the app

  Scenario: An inbox arrival wakes only the opted-in conversation
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When I open the "claude" agent on node "mail-quiet-agent"
    And the node agent's fold is ready
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    When mail delivers thread "b1" titled "New invoice" to the inbox
    Then mail has stored history cursor "101"
    And this conversation has 1 mail wakes
    And the latest mail wake names "New invoice"
    And the latest mail wake names "b1 (unread)"
    When I open the "claude" agent on node "mail-quiet-agent"
    And the node agent's fold is ready
    Then this conversation has 0 mail wakes

  Scenario: Arrivals during a running turn coalesce at the boundary
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When I ask the agent "hold"
    Then the agent is working
    When mail delivers thread "b1" titled "First arrival" to the inbox
    Then mail has stored history cursor "101"
    When mail delivers thread "b2" titled "Second arrival" to the inbox
    Then mail has stored history cursor "102"
    And this conversation has 0 mail wakes
    When the agent is released
    Then this conversation has 1 mail wakes
    And the latest mail wake names "2 threads"
    And the latest mail wake names "First arrival"
    And the latest mail wake names "Second arrival"

  Scenario: A message added outside the inbox rings nothing
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When mail delivers thread "a4" titled "Archived arrival" outside the inbox
    Then mail has stored history cursor "101"
    And this conversation has 0 mail wakes

  Scenario: Turning the property off drops queued mail and resumes without the gap
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When I ask the agent "hold"
    Then the agent is working
    When mail delivers thread "b1" titled "Queued before off" to the inbox
    Then mail has stored history cursor "101"
    When this node's inbox wake becomes "off"
    Then mail makes no history calls for a second
    When mail delivers thread "b2" titled "During the gap" to the inbox
    And the agent is released
    Then this conversation has 0 mail wakes
    When this node's inbox wake becomes "on"
    Then mail has stored history cursor "102"
    When mail delivers thread "b3" titled "After the gap" to the inbox
    Then mail has stored history cursor "103"
    And this conversation has 1 mail wakes
    And the latest mail wake names "After the gap"

  Scenario: Restart resumes the stored history cursor without replay
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When mail delivers thread "b1" titled "Before restart" to the inbox
    Then mail has stored history cursor "101"
    And this conversation has 1 mail wakes
    When the server stops
    And the server starts again on the same port
    And I reload the page
    Then the mail pill reads connected
    When I open the outline "inbox.olai"
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "101"
    When mail delivers thread "b2" titled "After restart" to the inbox
    Then mail has stored history cursor "102"
    And the latest mail wake names "After restart"

  Scenario: An expired history id seeds without ringing for the gap
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When the Gmail history cursor expires
    Then mail has stored history cursor "110"
    And this conversation has 0 mail wakes
    When mail delivers thread "b1" titled "After expiry" to the inbox
    Then mail has stored history cursor "111"
    And this conversation has 1 mail wakes

  Scenario: The poll knob follows live and a bad value defaults
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then mail has stored history cursor "100"
    When the mail poll setting becomes "1h"
    Then mail makes no history calls for a second
    When mail delivers thread "b1" titled "After cadence edit" to the inbox
    And the mail poll setting becomes "200ms"
    Then mail has stored history cursor "101"
    And this conversation has 1 mail wakes
    When the mail poll setting becomes "bad"
    Then mail makes no history calls for a second
    When I open the plugins panel
    Then the plugins panel shows "mail" configured "poll" as "2m"

  Scenario: With no account the opted-in node gets one connect notice
    When I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-inbox-agent"
    And the node agent's fold is ready
    Then this conversation has 1 mail wakes
    And the latest mail wake names "connect one in ⧉ plugins"
    And mail makes no history calls for a second
    And this conversation has 1 mail wakes

  Scenario Outline: An agent cannot opt itself into inbox wakes
    Given inbox consent is named "<key>"
    When I open the outline "inbox.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-quiet-agent"
    And the node agent's fold is ready
    And I ask the agent "set property mail-quiet-agent <key> on"
    Then the agent's answer mentions "a person's choice"
    And this conversation has 0 mail wakes

    Examples:
      | key        |
      | mail-inbox |
      | notify     |
