Feature: The day reminds you, and only once
  The first non-empty owed reading of the local day raises a notification.
  A chime can accompany it only after a gesture; a skipped sound is never
  replayed. The existing Agenda entry stays the durable face of due work.
  All scenarios use the ordinary focused page and the existing alerts stage.

  @scratch:good @alerts
  Scenario: Work owed at boot is announced without a sound, even after a later gesture
    Given I open the app
    And the notification worker is ready
    Then the agenda entry is on fire with 1 late
    And a notification says "Agenda: 1 overdue"
    And the notification is titled what the app calls itself
    And the notification is tagged for today
    And this browser has said today
    And no chime rang
    And the tab says nothing is waiting
    When I click the page
    Then no chime rang
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: Work that becomes due after a gesture chimes
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    Then the agenda entry is quiet
    When I click the page
    And a task is due today
    Then the agenda entry nudges with 1 on today
    And a notification says "Agenda: 1 on today"
    And the notification is tagged for today
    And the chime rang
    And the tab says nothing is waiting
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: A second dated task changes the entry and says nothing again
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    And I click the page
    When a task is due today
    Then a notification says "1 on today"
    And the chime rang
    When I remember the reminder
    And a second task is due today
    Then the agenda entry nudges with 2 on today
    And no second reminder has been raised
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: Reloading keeps the day said
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    And I click the page
    When a task is due today
    Then a notification says "1 on today"
    And the chime rang
    When I reload the page
    And the notification worker is ready
    Then the agenda entry nudges with 1 on today
    And no notification has been raised
    And no chime rang
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: A second tab opened afterwards keeps the day said
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    And I click the page
    When a task is due today
    Then a notification says "1 on today"
    And the chime rang
    When I open a second tab after the reminder
    Then there should be no page errors

  @scratch:journal @alerts
  Scenario: A reminder press reaches the agenda while chat listens for its own kind
    Given every date is taken off "work.olai"
    And I open the app
    And I open the outline "work.olai"
    And I open the "claude" agent on node "deck"
    And the node agent's fold is ready
    And I close the agent fold
    And the notification worker is ready
    And I click the page
    When a task is due today
    Then a notification says "1 on today"
    And the chime rang
    When the notification is pressed
    Then the agenda says it is today
    And the address is "/agenda"
    And no agent fold is open
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: A press that opened the window waits for the journal and is consumed once
    Given every date is taken off "work.olai"
    When I open the app from a pressed reminder
    Then the agenda says it is today
    And the address is "/agenda"
    And the reminder handoff is gone from the address
    When I reload the page
    Then the address is "/agenda"
    And the reminder handoff is gone from the address
    # Re-delivery at another page proves that the id is spent, beyond merely
    # observing the same agenda route twice after a reload.
    When the same reminder press is delivered again at the outline
    Then the address is "/work.olai"
    And the reminder handoff is gone from the address
    When I reload the page
    Then the address is "/work.olai"
    And the node "deck" is shown
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: Reminders off is off and does not spend the day
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    When I set Reminders to "off"
    Then this browser has stored that reminders are "off"
    And the Reminders row explains "Nothing says the day has work on it. The Agenda entry still shows it."
    When a task is due today
    Then the agenda entry nudges with 1 on today
    And no notification has been raised
    And no chime rang
    When I set Reminders to "on"
    Then a notification says "1 on today"
    And the chime rang
    And the Reminders row explains "with a chime if you have clicked the page since it opened."
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: Alerts off freezes Reminders and does not spend the day
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    When I set Alerts to "off"
    Then Reminders cannot be set
    And the Reminders row explains "Alerts are off, so nothing will remind you."
    When a task is due today
    Then the agenda entry nudges with 1 on today
    And no notification has been raised
    And no chime rang
    When I set Alerts to "on"
    Then a notification says "1 on today"
    And the chime rang
    And there should be no page errors

  @scratch:journal @alerts-denied
  Scenario: A browser that refused notifications still chimes after a gesture
    Given every date is taken off "work.olai"
    And I open the app
    And the notification worker is ready
    And I click the page
    When a task is due today
    Then the agenda entry nudges with 1 on today
    And the chime rang
    And no notification has been raised
    And this browser has said today
    And the tab says nothing is waiting
    And there should be no page errors

  @scratch:good @alerts-denied
  Scenario: A refused boot reminder spends the day without sound or replay
    Given I open the app
    And the notification worker is ready
    Then the agenda entry is on fire with 1 late
    And this browser has said today
    And no notification has been raised
    And no chime rang
    When I click the page
    Then no chime rang
    And the tab says nothing is waiting
    And there should be no page errors

  @scratch:journal @alerts
  Scenario: The journal takes its reminder and preference row with it
    Given every date is taken off "work.olai"
    And I open the outline "work.olai"
    And the notification worker is ready
    When I open the plugins panel
    And I switch the plugin "journal" off
    Then the Reminders row is absent
    When I press Escape on the preferences
    And a task is due today
    Then the node "sand" is shown
    And no notification has been raised
    And no chime rang
    When I open the plugins panel
    And I switch the plugin "journal" on
    Then the agenda entry nudges with 1 on today
    And a notification says "1 on today"
    And the chime rang
    And the Reminders row is shown
    When I remember the reminder
    And I press Escape on the preferences
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I switch the plugin "journal" on
    Then the agenda entry nudges with 1 on today
    And no second reminder has been raised
    And there should be no page errors

  @scratch:journal @alerts @rows-off:alerts
  Scenario: The alerts row off leaves calendar, day and agenda standing
    Given every date is taken off "work.olai"
    And I open the app
    When I open the plugins panel
    Then the plugins panel says "journal" is "Browser reminders: waiting for alerts.channel"
    And the preferences have no alert rows
    When I press Escape on the preferences
    And a task is due today
    Then the agenda entry nudges with 1 on today
    When I open today
    Then today is the one being read
    And today has something on it
    And the node "sand" is shown
    When I open the agenda
    Then the agenda says it is today
    And the node "sand" is shown
    And no notification has been raised
    And no chime rang
    And there should be no page errors
