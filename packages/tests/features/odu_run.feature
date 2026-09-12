Feature: A lane names its CI run by odu's run id

  The chip hangs off `odu-run`. The header says whether the service is
  speaking. A run nobody boards is not subscribed, even if it ran in the
  same checkout as one that is.

  @scratch:odu-run @odu-service:live
  Scenario: A boarded id draws a chip
    Given I open the outline "board.olai"
    Then the CI chip on "lane-a" is going
    And there should be no page errors

  @scratch:odu-run @odu-service:settled
  Scenario: A run first seen settled draws its verdict and rings nothing
    Given I open the outline "board.olai"
    Then the CI chip on "lane-a" is ok
    And there should be no page errors

  @scratch:odu-run @odu-service:red
  Scenario: A live run first seen red rings first-red
    Given I open the outline "board.olai"
    Then the CI chip on "lane-a" is red
    And there should be no page errors

  @scratch:odu-run @odu-service:live
  Scenario: A second run in the same checkout is silent unless boarded
    Given I open the outline "board.olai"
    Then the CI chip on "lane-a" is going
    And "lane-other" has no CI chip
    And there should be no page errors

  @scratch:odu-run
  Scenario: No odu is said in the header
    Given I open the outline "board.olai"
    Then the odu readout is absent
    And there should be no page errors

  @scratch:odu-run @odu-service:live
  Scenario: A live service is the quiet odu face
    Given I open the outline "board.olai"
    Then the odu readout is connected
    And there should be no page errors

  @scratch:odu-run @odu-service:skew
  Scenario: A skewed service names both versions
    Given I open the outline "board.olai"
    Then the odu readout is skew
    And there should be no page errors
