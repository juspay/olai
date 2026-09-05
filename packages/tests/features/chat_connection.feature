@scratch:chat
Feature: A chat draft and its uploaded attachment survive reconnecting
  Scenario: A completed upload remains usable after the network returns
    Given I open the app
    And the agent panel is open
    And I mark the page
    When I pick "Type 04-C.pdf" with the attach button
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    When I type "what is this" into the chat
    And the browser goes offline
    Then the connection is "reconnecting"
    And the app is frozen under the offline overlay
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the chat input reads "what is this"
    And the composer is holding "Type_04-C.pdf", showing how big it is
    When I send the chat message
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    And the composer is holding nothing
    And the page has not reloaded
