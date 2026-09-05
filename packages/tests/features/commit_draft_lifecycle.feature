@scratch:good @git:repo
Feature: A prepared commit survives a neighboring plugin rebuild
  Background:
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type "prepared handles"
    And I press "Enter"
    Then the commit pill says 1 uncommitted

  Scenario: The message remains editable and can be committed after rebuilding
    When I open the commit panel
    And I draft the commit message "describe the prepared work"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    When I open the commit panel
    Then the commit message still reads "describe the prepared work"
    When I submit the drafted commit
    Then the commit pill says "committed"
    And the last commit is "olai: describe the prepared work" by "web"
    And the repository is clean
    And there should be no page errors

  Scenario: A file excluded from the prepared commit stays excluded after rebuilding
    When I rewrite "separate.md" as:
      """
      Work for a separate commit
      """
    Then the commit pill says 2 uncommitted
    When I open the commit panel
    And I untick "separate.md"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    When I open the commit panel
    And I commit with the message "only the outline work"
    Then the commit pill says 1 uncommitted
    And the last commit touched exactly "house.olai"
    When I open the commit panel
    Then the commit button offers "Commit 1 file"
    When I commit with the message "the remaining work"
    Then the commit pill says "committed"
    And the last commit touched exactly "separate.md"
    And the repository is clean
    And there should be no page errors

  Scenario: Closing the panel to review the outline keeps the prepared message
    When I open the commit panel
    And I draft the commit message "reviewed before recording"
    And I press the commit pill
    Then the commit panel is shut
    And the node "handles" has the title "prepared handles"
    When I open the commit panel
    Then the commit message still reads "reviewed before recording"
    When I submit the drafted commit
    Then the commit pill says "committed"
    And the last commit is "olai: reviewed before recording" by "web"
    And the repository is clean
    And there should be no page errors
