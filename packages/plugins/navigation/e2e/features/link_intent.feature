@scratch:good @share-scratch
Feature: Every link has one destination and one gesture vocabulary
  Background:
    Given the link preview examples are served

  Scenario: A bare node address reveals its row rather than zooming
    When I open the address "/#preview-target"
    Then the focused pane is drawing the outline "preview.olai"
    And the unified destination row "preview-target" is selected
    And there should be no page errors

  Scenario Outline: Written links and see references share the same navigation
    Given I open the node "preview-source"
    When I activate the unified "<surface>" link with "<gesture>"
    Then the unified destination row "preview-target" is selected in pane <pane>
    And there are <count> panes
    And there should be no page errors

    Examples:
      | surface      | gesture   | pane | count |
      | note         | click     | 0    | 1     |
      | note         | Enter     | 0    | 1     |
      | note         | Alt       | 1    | 2     |
      | note         | Alt-Shift | 1    | 2     |
      | see          | click     | 0    | 1     |
      | see          | Enter     | 0    | 1     |
      | see          | Alt       | 1    | 2     |
      | see          | Alt-Shift | 1    | 2     |

  Scenario Outline: Links keep the link menu even inside an outline row
    Given I open the outline "preview.olai"
    When I open the unified "<surface>" link menu
    Then the unified link menu offers Open in new tab

    Examples:
      | surface |
      | bullet  |
      | see     |

  Scenario Outline: Same-document links have a shareable destination
    Given I open the address "/preview.md"
    When I activate the unified "heading" link with "<gesture>"
    Then pane <pane> is showing "/preview.md#end"
    And the document in pane <pane> is scrolled to the heading "End"
    And there should be no page errors

    Examples:
      | gesture   | pane |
      | click     | 0    |
      | Enter     | 0    |
      | Alt       | 1    |
      | Alt-Shift | 1    |
