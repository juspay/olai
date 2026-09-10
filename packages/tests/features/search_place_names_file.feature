@scratch:good
Feature: Every search result names its file before its ancestors
  Background:
    Given I rewrite "places.olai" as:
      """
      {"id":"place-root","ord":"a0","title":"Kitchen #home"}
      {"id":"place-parent","parent":"place-root","ord":"a0","title":"Cabinets"}
      {"id":"place-nested","parent":"place-parent","ord":"a0","title":"zinnia nested"}
      {"id":"place-top","ord":"a1","title":"zinnia top"}
      """
    And I rewrite "zinnia.md" as:
      """
      # zinnia document
      """
    And I open the outline "house.olai"

  Scenario: Nested nodes, top-level nodes and documents name their file without a glyph
    When I press the palette shortcut
    And I type "zinnia" into the palette
    Then the "palette-item" result "zinnia nested" has place "places.olai · Kitchen home · Cabinets"
    And the "palette-item" result "zinnia top" has place "places.olai"
    And the "palette-item" result "zinnia document" has place "zinnia.md"
    And there should be no page errors

  Scenario: The header and move picker use the same place line
    When I search the header for "zinnia"
    Then the "header-search-item" result "zinnia nested" has place "places.olai · Kitchen home · Cabinets"
    When I press "Escape"
    And I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "zinnia"
    Then the "move-hit" result "zinnia nested" has place "places.olai · Kitchen home · Cabinets"

  @phone
  Scenario: The phone palette preserves both ends of a deep path
    Given I rewrite "deep.olai" as:
      """
      {"id":"deep1","ord":"a0","title":"Kitchen with an exceptionally long and descriptive name"}
      {"id":"deep2","parent":"deep1","ord":"a0","title":"Bathroom with another exceptionally long and descriptive name"}
      {"id":"deep3","parent":"deep2","ord":"a0","title":"An extensive collection of plans and construction notes"}
      {"id":"deep4","parent":"deep3","ord":"a0","title":"Cabinets"}
      {"id":"deep5","parent":"deep4","ord":"a0","title":"zinnia deep"}
      """
    When I press the palette shortcut
    And I type "zinnia deep" into the palette
    Then the "palette-item" result "zinnia deep" preserves file "deep.olai" and nearest ancestor "Cabinets" around an ellipsis
    And there should be no page errors
