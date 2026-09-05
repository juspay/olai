@scratch:journal
Feature: Daily-note creation respects later user actions
  Scenario: A pending daily-note write cannot be submitted twice
    Given incoming updates to this browser tab can be held
    And I open the day "2019-11-20"
    When I hold incoming updates to the original browser tab
    And I press + day note
    Then the + day note button is waiting for its write
    When I release incoming updates to the original browser tab
    Then the document open is "Daily/2019/11/2019-11-20.md"
    And the document editor is open
    And there should be no page errors

  Scenario: A daily note created after navigating away does not replace the newer page
    Given incoming updates to this browser tab can be held
    And I open the day "2019-11-20"
    When I hold incoming updates to the original browser tab
    And I press + day note
    And I follow the outline "work.olai" while updates are delayed
    And I release incoming updates to the original browser tab
    # A subsequent browser query observes the released replies before we
    # assert the page: an immediate URL read could beat the late navigation.
    When I filter the page by "deck"
    Then the node "deck" is a match
    And the document editor is gone
    And the file "Daily/2019/11/2019-11-20.md" has been created
    And there should be no page errors
