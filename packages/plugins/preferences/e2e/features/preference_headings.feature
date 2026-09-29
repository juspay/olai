@scratch:good
Feature: A heading in the preferences is its contributors
  The panel draws no heading of its own. Each plugin contributes its rows to
  `preferences.sections` under the heading they belong to, so a heading is
  there exactly while one of its contributors is running: switch the plugin
  off and its heading goes from a panel that is OPEN in another tab, switch it
  back and the heading returns in its place — no reload, and no word from the
  panel about which plugins exist.

  The flip is made from a second tab on purpose: the claim is about a panel a
  person is looking at when the roster moves under it, and pressing the
  plugins panel in the same tab would shut this one first.

  Scenario: The Outlines heading leaves with outlines, and returns in its place
    Given I open the app
    And I mark the page
    When I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "outlines" off
    And I use the original browser tab
    Then the preferences have no "Outlines" heading
    And the preferences are headed "Appearance, Notifications, Git"
    When I use the other browser tab
    And I switch the plugin "outlines" on
    And I use the original browser tab
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Notifications goes when alerts does, Reminders included
    # Two plugins share this heading (alerts' Alerts and Sound, journal's
    # Reminders), and Reminders rides the alerts channel — so switching alerts
    # off withdraws every row under it, and the heading with them.
    Given I open the app
    And I mark the page
    When I open the preferences
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "alerts" off
    And I use the original browser tab
    Then the preferences have no "Notifications" heading
    And the preferences are headed "Appearance, Outlines, Git"
    When I use the other browser tab
    And I switch the plugin "alerts" on
    And I use the original browser tab
    Then the preferences are headed "Appearance, Outlines, Notifications, Git"
    And the page has not reloaded
    And there should be no page errors
