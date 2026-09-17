Feature: Waiting node agents alert the tab
  A question in an open fold is its own alert. An unread question rings,
  notifies and marks the tab; the identity-free click reveals the first waiter.

  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And the notification worker is ready

  @scratch:chat @alerts
  Scenario: A question that arrives behind a shut panel says so three ways
    When I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then a notification says "is waiting on your answer"
    And the notification is titled "kitchen remodel #home"
    And the tab says something is waiting
    And the chime rang

  @scratch:chat @alerts
  Scenario: A question that arrives in front of you is its own alert
    When I ask the agent "ask"
    Then the chat shows a question
    And no notification has been raised
    And no chime rang
    And the tab says nothing is waiting

  @scratch:chat @alerts
  Scenario: Pressing the notification opens the conversation at the question
    When I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then a notification says "is waiting on your answer"
    And the tab says something is waiting
    When the notification is pressed
    Then the panel is open at the question
    And the tab says nothing is waiting

  @scratch:chat @alerts
  Scenario: Answering it puts the mark away wherever you are
    When I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then the tab says something is waiting
    When the notification is pressed
    And I choose "birch"
    And I answer the question
    Then the question has been answered
    And the tab says nothing is waiting

  @scratch:chat @alerts
  Scenario: Alerts off is off, and the icon is put back
    When I set Alerts to "off"
    And I press Escape on the preferences
    And I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then the agent "kitchen" stands "needs-you"
    And no notification has been raised
    And no chime rang
    And the tab says nothing is waiting
    And this browser has stored that alerts are "off"

  @scratch:chat @alerts
  Scenario: The sound is its own switch, and says so
    When I set the alert sound to "off"
    Then this browser has stored that the alert sound is "off"
    When I set Alerts to "off"
    Then the alert sound cannot be set
    And the Alerts row explains "silent"

  @scratch:chat @alerts-denied
  Scenario: A browser that has refused notifications still chimes and still marks the tab
    When I ask the agent "ask later"
    And I close the agent fold
    And the agent is released
    Then the agent "kitchen" stands "needs-you"
    And no notification has been raised
    And the chime rang
    And the tab says something is waiting
