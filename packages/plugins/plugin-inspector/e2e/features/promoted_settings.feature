@scratch:good
Feature: A promoted setting is not a control here
  A config schema leaf a plugin marks as a preference is drawn in the
  preferences panel while that plugin runs, and this row shows one **Set in
  Preferences** link where those controls were. While the plugin is OFF, or the
  preferences panel is absent, the controls are drawn here exactly as they
  were — the setting stays editable from whichever panel can move it.

  Scenario: The row offers the settings in Preferences instead of their controls
    Given I open the app
    When I open the plugins panel
    And I expand the plugin "git"
    Then the plugin "git" row offers its settings in Preferences
    And the plugin "git" row draws no "commit" control
    And the plugin "git" row draws no "push" control
    And there should be no page errors

  Scenario: Following the link shuts this panel and opens Preferences
    Given I open the app
    When I open the plugins panel
    And I follow the Set in Preferences link on "git"
    Then the preferences are open
    And the preference "plugin-git-commit" is drawn under the heading "Git"
    And the plugins panel is shut

  Scenario: While the plugin is off its control is drawn here, as it always was
    Given I open the app
    When I open the plugins panel
    And I switch the plugin "git" off
    And I expand the plugin "git"
    Then the plugin "git" row draws its own "commit" control
    And the plugin "git" row draws no Preferences link
    And there should be no page errors

  @rows-off:preferences
  Scenario: With Preferences disabled the control comes back here
    Given I open the app
    When I open the plugins panel
    And I expand the plugin "git"
    Then the plugin "git" row draws its own "commit" control
    And the plugin "git" row draws no Preferences link
    And there should be no page errors

  Scenario: Opening a fully promoted row lands in Preferences
    # THE PANEL'S OWN `configuration.open(name)`, driven by a controller a
    # scenario approves. A row whose every leaf is drawn in the preferences
    # panel has nothing to open HERE — the one control it would reveal is a link
    # — so asking for that row's settings lands on them rather than on a door to
    # them, which is one press instead of two.
    Given the vault defines a row opener
    And I open the outline "house.olai"
    And I open the plugins panel
    And I approve the plugin "row-opener"
    When the controller opens the plugin row "git"
    Then the preferences are open
    And the preference "plugin-git-commit" is drawn under the heading "Git"
    And the plugins panel is shut
    And there should be no page errors

  Scenario: Switching the inspector off in another tab withdraws the promoted rows
    Given I open the app
    And I mark the page
    When I open the preferences
    Then the preference "plugin-git-commit" is drawn under the heading "Git"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "plugin-inspector" off
    And I use the original browser tab
    Then the preferences have no "Git" heading
    And the preferences are headed "Appearance, Outlines, Notifications"
    And the page has not reloaded
    And there should be no page errors

  @phone
  Scenario: On a phone the link opens Preferences from the drawer
    Given I open the app
    When I tap the burger
    And I open the plugins panel
    And I follow the Set in Preferences link on "git"
    Then the preferences are open
    And the preference "plugin-git-commit" is drawn under the heading "Git"
    And there should be no page errors