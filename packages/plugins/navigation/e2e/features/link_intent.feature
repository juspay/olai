@scratch:good @share-scratch
Feature: Every link has one destination and one gesture vocabulary
  Background:
    Given the link preview examples are served
    And the unified document links are served

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
    And I open the note of "preview-source"
    And the unified "<surface>" link leaves "middle" to the browser
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
    And the unified heading "End" is visible in pane <pane>
    And there should be no page errors

    Examples:
      | gesture   | pane |
      | click     | 0    |
      | Enter     | 0    |
      | Alt       | 1    |
      | Alt-Shift | 1    |

  Scenario Outline: Navigable surfaces share reveal and keyboard or split intent
    Given I prepare the unified "<surface>" surface
    When I activate the unified "<surface>" link with "<gesture>"
    Then the unified destination row "<target>" is selected in pane <pane>
    And there should be no page errors

    Examples:
      | surface | gesture | target | pane |
      | title | click | preview-target | 0 |
      | title | Enter | preview-target | 0 |
      | title | Alt | preview-target | 1 |
      | title | Alt-Shift | preview-target | 1 |
      | document | click | preview-target | 0 |
      | document | Enter | preview-target | 0 |
      | document | Alt | preview-target | 1 |
      | document | Alt-Shift | preview-target | 1 |
      | backlink | click | preview-source | 0 |
      | backlink | Enter | preview-source | 0 |
      | backlink | Alt | preview-source | 1 |
      | backlink | Alt-Shift | preview-source | 1 |
      | breadcrumb | click | preview-target | 0 |
      | breadcrumb | Enter | preview-target | 0 |
      | breadcrumb | Alt | preview-target | 1 |
      | breadcrumb | Alt-Shift | preview-target | 1 |
      | palette | click | preview-target | 0 |
      | palette | Enter | preview-target | 0 |
      | palette | Alt | preview-target | 1 |
      | palette | Alt-Shift | preview-target | 1 |
      | search | click | preview-target | 0 |
      | search | Enter | preview-target | 0 |
      | search | Alt | preview-target | 1 |
      | search | Alt-Shift | preview-target | 1 |
      | html | click | preview-target | 0 |
      | html | Enter | preview-target | 0 |
      | html | Alt | preview-target | 1 |
      | html | Alt-Shift | preview-target | 1 |
      | card | click | preview-destination | 0 |
      | card | Enter | preview-destination | 0 |
      | card | Alt | preview-destination | 1 |
      | card | Alt-Shift | preview-destination | 1 |

  Scenario Outline: Browser modifiers and link menus do not select an outline row
    Given I prepare the unified "<surface>" surface
    Then the unified "<surface>" link leaves "Ctrl" to the browser
    And the unified "<surface>" link leaves "Meta" to the browser
    And the unified "<surface>" link leaves "middle" to the browser
    When I open the unified "<surface>" link menu
    Then the unified link menu offers Open in new tab

    Examples:
      | surface |
      | note |
      | title |
      | see |
      | document |
      | backlink |
      | breadcrumb |
      | palette |
      | search |
      | rail |
      | card |
      | heading |
      | toc |
      | html |

  Scenario Outline: Hover reads the same href as activation
    Given I prepare the unified "<surface>" surface
    Then the unified "<surface>" link previews "<text>"

    Examples:
      | surface | text |
      | note | Preview target |
      | title | Preview target |
      | see | Preview target |
      | document | Preview target |
      | backlink | Preview source |
      | breadcrumb | Preview target |
      | palette | Preview target |
      | search | Preview target |
      | heading | Paragraph after |
      | toc | Paragraph after |
      | html | Preview target |

  Scenario: Alt-Shift inserts while Alt reuses the neighbour
    Given I open the node "preview-source"
    When I activate the unified "note" link with "Alt"
    Then there are 2 panes
    When I activate the unified "see" link with "Alt-Shift"
    Then there are 3 panes
    And pane 1 is focused
    And the unified destination row "preview-target" is selected in pane 1

  Scenario Outline: TOC anchors route to the heading in the intended pane
    Given I prepare the unified "toc" surface
    When I activate the unified "toc" link with "<gesture>"
    Then pane <pane> is showing "/intent.md#end"
    And the unified heading "End" is visible in pane <pane>

    Examples:
      | gesture | pane |
      | click | 0 |
      | Enter | 0 |
      | Alt | 1 |
      | Alt-Shift | 1 |

  Scenario Outline: Sidebar rail entries are ordinary navigable anchors
    Given I prepare the unified "rail" surface
    When I activate the unified "rail" link with "<gesture>"
    Then pane <pane> is showing "/trash"

    Examples:
      | gesture | pane |
      | click | 0 |
      | Enter | 0 |
      | Alt | 1 |
      | Alt-Shift | 1 |

  Scenario: Old background tabs and layout segments retain zoom destinations
    Given I open the outline "house.olai"
    And legacy zoom tabs are stored
    Then there are 3 tabs
    When I press tab 1
    Then the zoomed node is "install"
    And the address is exactly "/zoom/#install"
    When I press tab 2
    Then the zoomed node in pane 1 is "order"

  Scenario: A restored legacy history entry keeps its zoom destination
    Given I open the outline "house.olai"
    And a legacy zoom history entry is restored
    Then the zoomed node is "install"
    And the address is exactly "/zoom/#install"

  Scenario: A visible destination stays in its source pane while another pane is focused
    Given I open the address "/s/preview.olai/house.olai?f=1"
    And I open the note of "preview-source"
    When I activate the unified "note" link with "click"
    Then pane 0 is focused
    And pane 0 is showing "/preview.olai"
    And pane 1 is showing "/house.olai"
    And the unified destination row "preview-target" is selected in pane 0

  Scenario: A delegated link keeps working after an optional neighbour reconnects
    Given I prepare the unified "document" surface
    When I set the preview plugin "outlines" off on disk
    And I set the preview plugin "outlines" on on disk
    And I activate the unified "document" link with "click"
    Then the unified destination row "preview-target" is selected
    And there are 1 panes
    When I go back
    Then the address is exactly "/intent.md"
