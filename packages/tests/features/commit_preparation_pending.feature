@scratch:good @git:repo
Feature: Prepared commits survive refusal and late acknowledgement
  Background:
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type "work for the first commit"
    And I press "Enter"
    And I rewrite "separate.md" as:
      """
      Work for a separate commit
      """
    Then the commit pill says 2 uncommitted
    When I open the commit panel
    And I untick "separate.md"
    And I draft the commit message "only the outline"

  Scenario: A refused commit keeps its prepared message and excluded file for a valid retry
    Given git signing cannot run in this repository
    When I submit the drafted commit
    Then the commit pill says "error"
    And olai has recorded 0 commits here
    And the commit message still reads "only the outline"
    When I press the commit pill
    And I turn off signing in this repository
    And I open the commit panel
    Then the commit message still reads "only the outline"
    When I submit the drafted commit
    Then the commit pill says 1 uncommitted
    And the last commit is "olai: only the outline" by "web"
    And the last commit touched exactly "house.olai"
    And there should be no page errors

  Scenario: An earlier reply leaves the next message and selection intact
    When I hold incoming updates to the original browser tab
    And I submit the drafted commit
    And I draft the commit message "now the separate work"
    And I tick "separate.md"
    And I release incoming updates to the original browser tab
    Then the commit pill says 1 uncommitted
    And the last commit touched exactly "house.olai"
    And the commit message still reads "now the separate work"
    And the commit button offers "Commit 1 file"
    When I submit the drafted commit
    Then the commit pill says "committed"
    And the last commit is "olai: now the separate work" by "web"
    And the last commit touched exactly "separate.md"
    And the repository is clean
    And there should be no page errors
