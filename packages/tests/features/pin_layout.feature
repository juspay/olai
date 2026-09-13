@share-scratch
@scratch:good
Feature: Pinning layouts
  A named shelf entry restores the saved pages as one workspace and one history push.

  Background:
    Given I open the outline "house.olai"

  Scenario: A resized layout saves only pages and opens equally with first focus
    When I open the address "/s/house.olai/garden.olai?w=25,75&f=1"
    And I widen the first pane by dragging its divider
    And I pin the layout
    Then the palette asks "a name for this layout — Escape backs out"
    When I name the pin "Planning"
    Then the pin "/s/house.olai/garden.olai" is named "Planning"
    And the pin "/s/house.olai/garden.olai" has a split mark
    And the pin "/s/house.olai/garden.olai" has tooltip "house.olai · garden.olai"
    And the pin "/s/house.olai/garden.olai" is current
    And "_olai/Pins.olai" holds a node titled "[Planning](/s/house.olai/garden.olai)"
    When I open the document "finishes.md"
    And I follow the pin "/s/house.olai/garden.olai"
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/garden.olai"
    And pane 0 is focused
    And the layout panes have equal widths
    And the address is exactly "/s/house.olai/garden.olai"
    When I go back
    Then there are 1 panes
    And the address is exactly "/finishes.md"
    And there should be no page errors

  Scenario Outline: A saved workspace replaces a different split even with modifiers
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai?w=10,90&f=1) |
    When I open the address "/s/%23order/finishes.md"
    And I <modifier>-click the layout pin "/s/house.olai/garden.olai"
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/garden.olai"
    And pane 0 is focused
    And the layout panes have equal widths
    When I go back
    Then pane 0 is showing "/#order"
    And pane 1 is showing "/finishes.md"

    Examples:
      | modifier |
      | plain    |
      | Alt      |
      | Shift    |

  Scenario: Empty names are refused and Escape and the removed chord write nothing
    When I open the address "/s/house.olai/garden.olai"
    And I pin the layout
    And I name the pin ""
    Then the palette says "a layout needs a name"
    And the palette asks "a name for this layout — Escape backs out"
    When I press "Escape"
    Then "_olai/Pins.olai" holds nothing
    When I press "ControlOrMeta+Shift+p"
    Then the pinned shelf is not drawn
    And "_olai/Pins.olai" holds nothing

  Scenario: Both unpin controls are undoable
    When I open the address "/s/house.olai/garden.olai"
    And I pin the layout
    And I name the pin "Planning"
    Then the pinned shelf holds "/s/house.olai/garden.olai"
    When I press "ControlOrMeta+k"
    And I type "pin" into the palette
    Then the palette offers "Unpin this layout"
    When I choose "Unpin this layout" from the palette
    Then the pinned shelf is not drawn
    When I press "ControlOrMeta+z"
    Then the pinned shelf holds "/s/house.olai/garden.olai"
    When I unpin "/s/house.olai/garden.olai"
    Then the pinned shelf is not drawn
    When I press "ControlOrMeta+z"
    Then the pinned shelf holds "/s/house.olai/garden.olai"

  Scenario: Renaming requires a name and preserves the authored address
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai?w=20,80&f=1) |
    When I rename the pin "/s/house.olai/garden.olai"
    And I name the pin ""
    Then the palette says "a layout needs a name"
    And the palette asks "a name for this layout — Escape backs out"
    When I name the pin "Today"
    Then the pin "/s/house.olai/garden.olai" is named "Today"
    And "_olai/Pins.olai" holds a node titled "[Today](/s/house.olai/garden.olai?w=20,80&f=1)"
    When I press "ControlOrMeta+z"
    Then the pin "/s/house.olai/garden.olai" is named "Planning"

  Scenario: Agent-written bare and named layouts arrive live and open whole
    When I mark the page
    And the directory grows a pin to "/s/house.olai/%23missing"
    Then the pin "/s/house.olai/%23missing" is named "house.olai · /#missing"
    And the pin "/s/house.olai/%23missing" has a split mark
    When the directory grows a pin to "[Planning](/s/house.olai/garden.olai)"
    Then the pin "/s/house.olai/garden.olai" is named "Planning"
    And the page has not reloaded
    When I follow the pin "/s/house.olai/%23missing"
    Then there are 2 panes
    And pane 1 is showing "/#missing"
    When I follow the pin "/s/house.olai/garden.olai"
    Then there are 2 panes
    And pane 1 is showing "/garden.olai"
    And there should be no page errors

  Scenario: A layout containing a trashed node still opens both panes
    Given the directory has the pins:
      | [Planning](/s/house.olai/%23order) |
    When I open the node menu of "order"
    And I choose "Move to Trash" from the node menu
    And I follow the pin "/s/house.olai/%23order"
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/#order"
    And there should be no page errors

  Scenario: A lone page has only the page command
    When I press "ControlOrMeta+k"
    And I type "pin" into the palette
    Then the palette offers "Pin this page"
    And the palette does not offer "Pin this layout"

  Scenario: Page pinning in a split acts on the focused pane
    When I open the address "/s/house.olai/garden.olai?f=1"
    And I pin the page
    Then the pinned shelf holds "/garden.olai"
    And "_olai/Pins.olai" holds a node titled "/garden.olai"
    And there are 2 panes

  Scenario: Page and layout pins can both be current
    Given the directory has the pins:
      | /house.olai |
      | [Planning](/s/house.olai/garden.olai) |
    When I follow the pin "/s/house.olai/garden.olai"
    Then the pin "/house.olai" is current
    And the pin "/s/house.olai/garden.olai" is current

  Scenario: A layout pin on a phone opens the tab strip
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai) |
    When I shrink the window to a phone
    And I follow the pin "/s/house.olai/garden.olai"
    Then the pane tabs are shown
    And there are 2 pane tabs
    And pane 0 is showing "/house.olai"
    And pane 0 is focused
    When I tap pane tab 1
    Then pane 1 is focused
    And pane 1 is showing "/garden.olai"
    And there should be no page errors


  Scenario: Width and focus changes leave a layout current and offer Unpin
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai) |
    When I open the address "/s/house.olai/garden.olai?w=30,70&f=1"
    Then the pin "/s/house.olai/garden.olai" is current
    When I press "ControlOrMeta+k"
    And I type "pin" into the palette
    Then the palette offers "Unpin this layout"
    And the palette does not offer "Pin this layout…"

  Scenario: Layout titles on the Pins outline share the face and navigate without reloading
    Given the directory has the pins:
      | /s/house.olai/%23missing |
      | [Planning](/s/house.olai/garden.olai?w=20,80&f=1) |
    When I open "_olai/Pins.olai" from the vault group
    Then the node "p0" reads "house.olai · /#missing"
    And the node "p0" has a split mark
    And the node "p1" reads "Planning"
    And the node "p1" has a split mark
    When I click the title of "p0"
    Then the editor holds "/s/house.olai/%23missing"
    When I press "Escape"
    And I mark the page
    And I press the name of "p1"
    Then there are 2 panes
    And pane 0 is showing "/house.olai"
    And pane 1 is showing "/garden.olai"
    And pane 0 is focused
    And the layout panes have equal widths
    And the page has not reloaded
    When I go back
    Then the address is exactly "/_olai/Pins.olai"
    And there should be no page errors

  Scenario Outline: Browser gestures open layout links in a new tab
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai) |
    When I open "_olai/Pins.olai" from the vault group
    And I mark the page
    And I open the <surface> layout link "<target>" in a new tab with "<gesture>"
    Then the address is exactly "/_olai/Pins.olai"
    And there are 1 panes
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | surface | target                       | gesture       |
      | shelf   | /s/house.olai/garden.olai      | ControlOrMeta |
      | shelf   | /s/house.olai/garden.olai      | middle        |
      | outline | p0                           | ControlOrMeta |
      | outline | p0                           | middle        |

  Scenario: A saved pane can name a real file under the s directory
    When I rewrite "s/notes.olai" as:
      """
      {"id":"under-s","ord":"a0","title":"A real file under s"}
      """
    And the directory grows a pin to "[Notes](/s/s%2Fnotes.olai/house.olai)"
    And I follow the pin "/s/s%2Fnotes.olai/house.olai"
    Then pane 0 is showing "/s/notes.olai"
    And pane 1 is showing "/house.olai"
    And the node "under-s" reads "A real file under s"
    And there should be no page errors

  Scenario: The naming question replaces the command list until cancelled
    When I open the address "/s/house.olai/garden.olai"
    And I pin the layout
    And I type "Planning" into the palette
    Then the palette asks "a name for this layout — Escape backs out"
    And the palette does not offer "Pin this layout…"
    And the palette does not offer "Pin this page"
    And the palette box holds "Planning"
    When I press "Escape"
    Then "_olai/Pins.olai" holds nothing
