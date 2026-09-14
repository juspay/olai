@scratch:good
Feature: Open mirrors follow source replacement and plugin rebuilds
  Background:
    Given I rewrite "source.olai" as:
      """
      {"id":"mirror-source","ord":"a0","title":"original source"}
      {"id":"mirror-child","parent":"mirror-source","ord":"a0","title":"original child"}
      """
    And I rewrite "placement.olai" as:
      """
      {"id":"placement","ord":"a0","mirror":"mirror-source"}
      """
    And I open the outline "placement.olai"
    And I mark the page
    Then the node "placement" is marked as a mirror
    And the node "mirror-child" is a child of "placement"

  Scenario: Replacing the source subtree updates the mirror and edits reach the source file
    When I rewrite "source.olai" as:
      """
      {"id":"mirror-source","ord":"a0","title":"replacement source"}
      {"id":"replacement-child","parent":"mirror-source","ord":"a0","title":"replacement child"}
      """
    Then the node "placement" has the title "⇢replacement source"
    And the node "replacement-child" is a child of "placement"
    And the node "mirror-child" is not shown
    When I click the title of "replacement-child"
    And I select all and type "edited through the mirror"
    And I press "Enter"
    And I press "Escape"
    Then "source.olai" holds a node titled "edited through the mirror"
    When I zoom into the node "placement"
    Then the zoomed node is "mirror-source"
    And the breadcrumbs are "source.olai"
    And the node titled "edited through the mirror" is shown
    When I go back
    Then the node "placement" is marked as a mirror
    And the node titled "edited through the mirror" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: A rebuilt mirror remains editable and its undo restores the source
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the node "placement" is marked as a mirror
    When I click the title of "mirror-child"
    And I select all and type "edited after the rebuild"
    And I press "Enter"
    And I press "Escape"
    Then "source.olai" holds a node titled "edited after the rebuild"
    When I press "ControlOrMeta+z"
    Then "source.olai" holds a node titled "original child"
    And the node titled "original child" is shown
    When I zoom into the node "placement"
    Then the zoomed node is "mirror-source"
    And the breadcrumbs are "source.olai"
    And the node titled "original child" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: Removing and restoring the source recovers the open mirror in another file
    When I remove the served file "source.olai"
    Then the outline failure shows an error at "placement.olai:1"
    When I rewrite "relocated.olai" as:
      """
      {"id":"mirror-source","ord":"a0","title":"relocated source"}
      {"id":"mirror-child","parent":"mirror-source","ord":"a0","title":"restored child"}
      """
    Then the node "placement" is marked as a mirror
    And the node "mirror-child" is a child of "placement"
    And the node titled "restored child" is shown
    When I zoom into the node "placement"
    Then the zoomed node is "mirror-source"
    And the breadcrumbs are "relocated.olai"
    When I click the title of "mirror-child"
    And I select all and type "edited after source recovery"
    And I press "Enter"
    And I press "Escape"
    Then "relocated.olai" holds a node titled "edited after source recovery"
    And the page has not reloaded
    And there should be no page errors
