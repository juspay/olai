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