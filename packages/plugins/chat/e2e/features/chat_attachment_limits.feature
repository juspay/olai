@scratch:chat
Feature: Attachment size boundaries leave the composer usable
  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And I mark the page

  Scenario: Rejecting an oversized drop preserves a ready attachment and the unsent message
    When I pick "Type 04-C.pdf" with the attach button
    Then the composer is holding "Type_04-C.pdf", showing how big it is
    When I type "read the retained file" into the chat
    And I drop a text file one byte over the attachment limit
    Then the chat eventually shows "oversized.txt"
    And the chat eventually shows "over the 50 MB limit"
    And the chat input reads "read the retained file"
    And the composer is holding "Type_04-C.pdf" in that order
    When I send the chat message
    Then the agent's answer mentions "read 69 bytes from Type_04-C.pdf"
    And the composer is holding nothing
    When I attach a text file named "after-limit.txt" containing "retry"
    And I ask the agent "read the next valid file"
    Then the agent's answer mentions "read 5 bytes from after-limit.txt"
    And the composer is holding nothing
    And the page has not reloaded
    And there should be no page errors

  Scenario: An empty text file is attached and sent as a zero-byte file
    When I attach a text file named "empty.txt" containing ""
    Then the pending attachment "empty.txt" shows size "0 B"
    When I ask the agent "read the empty file"
    Then the agent's answer mentions "read 0 bytes from empty.txt"
    And the composer is holding nothing
    When I attach a text file named "after-empty.txt" containing "next"
    And I ask the agent "read the following file"
    Then the agent's answer mentions "read 4 bytes from after-empty.txt"
    And the composer is holding nothing
    And the page has not reloaded
    And there should be no page errors

  Scenario: A file exactly at the size limit arrives with every uploaded byte intact
    When I drop a text file exactly at the attachment limit
    Then the pending attachment "at-limit.txt" shows size "50 MB"
    When I ask the agent "verify attachment bytes"
    Then the agent's answer mentions "read 52428800 bytes from at-limit.txt"
    And the agent confirms every byte of the boundary attachment
    And the composer is holding nothing
    And the page has not reloaded
    And there should be no page errors

  Scenario: A video above the document cap arrives byte-exact on disk
    When I drop a video larger than the document limit
    Then the pending attachment "large.mp4" shows size "50 MB"
    When I ask the agent "verify video bytes"
    Then the agent's answer mentions "read 52428801 bytes from large.mp4"
    And the agent confirms every byte of the large video
    And the composer is holding nothing
    And the page has not reloaded
    And there should be no page errors

  Scenario: A video above its own cap is refused without losing the draft
    When I type "keep this message" into the chat
    And I drop a video one byte over the video limit
    Then the chat eventually shows "oversized.mp4"
    And the chat eventually shows "over the 200 MB limit"
    And the chat input reads "keep this message"
    And the composer is holding nothing
    When I pick "retry.mp4" with the attach button
    Then the composer is holding "retry.mp4", showing how big it is
    When I ask the agent "read the retry"
    Then the agent read "retry.mp4" in that order
    And the page has not reloaded
    And there should be no page errors
