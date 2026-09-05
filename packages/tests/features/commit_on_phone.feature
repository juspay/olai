@phone @scratch:good @git:repo
Feature: Selective commits remain usable on a phone
  Scenario: A phone can prepare a partial commit and then record the remaining long-path file
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type "phone review of handles"
    And I press "Enter"
    And I rewrite "notes/a-long-document-name-for-a-separate-phone-commit.md" as:
      """
      # Work for a separate commit
      """
    Then the phone commit banner says 2 uncommitted
    And the phone commit banner sits below the header
    When I open the commit panel
    And I untick "notes/a-long-document-name-for-a-separate-phone-commit.md"
    And I draft the commit message "reviewed the handles on my phone"
    And I tap the commit banner
    Then the commit panel is shut
    When I open the commit panel
    Then the commit message still reads "reviewed the handles on my phone"
    When I submit the drafted commit
    Then the phone commit banner says 1 uncommitted
    And the last commit is "olai: reviewed the handles on my phone" by "web"
    And the last commit touched exactly "house.olai"
    When I open the commit panel
    Then the commit button offers "Commit 1 file"
    When I commit with the message "the separate document"
    Then the phone commit banner is gone
    And the last commit touched exactly "notes/a-long-document-name-for-a-separate-phone-commit.md"
    And the repository is clean
    And there should be no page errors

  Scenario: Disabling and restoring Git on a phone preserves prepared work and restores one usable banner
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I select all and type "waiting through a ledger restart"
    And I press "Enter"
    Then the phone commit banner says 1 uncommitted
    When I open the commit panel
    And I draft the commit message "record after restoring git"
    And I tap the commit banner
    And I press the sidebar shortcut
    And I open the plugins panel
    And I switch the plugin "git" off
    And I press "Escape"
    Then the phone commit banner is gone
    When I press the sidebar shortcut
    And I open the plugins panel
    And I switch the plugin "git" on
    And I press "Escape"
    Then the phone commit banner says 1 uncommitted
    And the phone commit banner sits below the header
    When I open the commit panel
    Then the commit message still reads "record after restoring git"
    When I submit the drafted commit
    Then the phone commit banner is gone
    And the last commit is "olai: record after restoring git" by "web"
    And the repository is clean
    And the page has not reloaded
    And there should be no page errors
