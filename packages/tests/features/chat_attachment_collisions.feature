@scratch:chat
Feature: Concurrent attachments with the same name retain distinct bytes
  Scenario: Two overlapping drops in one conversation remain independently readable
    Given I open the app
    And the agent panel is open
    And I mark the page
    When I drop two different text files with the same name at once
    Then the pending attachment "collision.txt" shows size "5 B"
    And the pending attachment "collision-1.txt" shows size "5 B"
    When I ask the agent "verify attachment bytes"
    Then the agent's answer mentions "read 5 bytes from collision.txt"
    And the agent's answer mentions "read 5 bytes from collision-1.txt"
    And the agent confirms attachment content "alpha"
    And the agent confirms attachment content "bravo"
    And the composer is holding nothing
    And the page has not reloaded
    And there should be no page errors
