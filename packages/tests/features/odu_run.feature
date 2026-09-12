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

  @scratch:odu-run @odu-service:live
  Scenario: A boarded id the service has not named is an unknown chip
    Given I open the outline "board.olai"
    Then the CI chip on "lane-unknown" is quiet
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

  @scratch:odu-run @odu-service:red
  Scenario: A scoped conversation hears first-red for a live run seen red
    Given I open the outline "board.olai"
    And I rewrite "board.olai" as:
      """
      {"id":"board","ord":"a0","title":"the board"}
      {"id":"lane-a","parent":"board","ord":"a0","title":"the seam","doing":true}
      {"id":"lane-other","parent":"board","ord":"a1","title":"another checkout","doing":true}
      {"id":"door-live","parent":"board","ord":"a3","title":"watch the connector","doing":true,"custom":{"agent-session":"claude:fake-session-1"}}
      """
    And I press the agent "door-live"
    And the node agent's fold is ready
    And I open the "node-bound" conversation for delivery
    Then this conversation's "odu" wake is on nothing
    When I point this conversation's "odu" wake at "board.olai"
    Then this conversation's "odu" wake is on "board.olai"
    When I rewrite "board.olai" as:
      """
      {"id":"board","ord":"a0","title":"the board"}
      {"id":"lane-a","parent":"board","ord":"a0","title":"the seam","doing":true,"custom":{"odu-run":"m1kb0e11-2c8d"}}
      {"id":"lane-other","parent":"board","ord":"a1","title":"another checkout","doing":true}
      {"id":"door-live","parent":"board","ord":"a3","title":"watch the connector","doing":true,"custom":{"agent-session":"claude:fake-session-1"}}
      """
    Then the chat shows a sentence no person typed
    And that sentence was rung by "odu"
    And that sentence names "m1kb0e11-2c8d"
    And that sentence does not name "m1same00-bbbb"
    And there should be no page errors

  @scratch:odu-run @odu-service:settled
  Scenario: A scoped conversation hears nothing for a run first seen settled
    Given I open the outline "board.olai"
    And I rewrite "board.olai" as:
      """
      {"id":"board","ord":"a0","title":"the board"}
      {"id":"lane-a","parent":"board","ord":"a0","title":"the seam","doing":true}
      {"id":"door-live","parent":"board","ord":"a3","title":"watch the connector","doing":true,"custom":{"agent-session":"claude:fake-session-1"}}
      """
    And I press the agent "door-live"
    And the node agent's fold is ready
    And I open the "node-bound" conversation for delivery
    When I point this conversation's "odu" wake at "board.olai"
    Then this conversation's "odu" wake is on "board.olai"
    When I rewrite "board.olai" as:
      """
      {"id":"board","ord":"a0","title":"the board"}
      {"id":"lane-a","parent":"board","ord":"a0","title":"the seam","doing":true,"custom":{"odu-run":"m1kb0e11-2c8d"}}
      {"id":"door-live","parent":"board","ord":"a3","title":"watch the connector","doing":true,"custom":{"agent-session":"claude:fake-session-1"}}
      """
    Then the CI chip on "lane-a" is ok
    And the chat shows no sentence no person typed
    And there should be no page errors
