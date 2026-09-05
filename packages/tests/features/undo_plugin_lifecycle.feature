@scratch:good
Feature: Undo history survives plugin changes without overwriting other work
  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: One undo after a provider change takes back only the latest of two text edits
    When I click the title of "handles"
    And I select all and type "first retained edit"
    And I press "Enter"
    And I press "Escape"
    Then the node "handles" has the title "first retained edit"
    When I click the title of "knobs"
    And I select all and type "second retained edit"
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "second retained edit"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    When I press "ControlOrMeta+z"
    Then the node "knobs" has the title "pick the knobs"
    And the node "handles" has the title "first retained edit"
    When I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Structural undo and redo remain usable after another tab changes plugins
    When I click the title of "knobs"
    And I press "Tab"
    And I click away from the editor
    Then the node "knobs" is a child of "hinges"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "hinges" comes before "knobs"
    When I press "ControlOrMeta+Shift+z"
    Then the node "knobs" is a child of "hinges"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A plugin rebuild preserves the conflict guard on a text undo
    When I click the title of "knobs"
    And I select all and type "my brass knobs"
    And I press "Enter"
    And I press "Escape"
    Then the node "knobs" has the title "my brass knobs"
    When I open another browser tab
    And I click the title of "knobs"
    And I select all and type "somebody else's chrome knobs"
    And I press "Enter"
    And I press "Escape"
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the node "knobs" has the title "somebody else's chrome knobs"
    When I press "ControlOrMeta+z"
    Then the undo refusal says "has been retitled since"
    And "house.olai" holds a node titled "somebody else's chrome knobs"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A note redo survives a plugin rebuild and a new file starts a fresh history
    When I open the note of "order"
    And I click the note of "order"
    And I type " — measured twice"
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds a node whose note ends "before ordering."
    When I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    Then the journal chrome is absent
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds a node whose note ends "— measured twice"
    When I click the outline "garden.olai"
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"
    When I click the outline "house.olai"
    And I press "ControlOrMeta+Shift+z"
    Then the undo says "nothing to redo"
    And "house.olai" holds a node whose note ends "— measured twice"
    And the page has not reloaded
    And there should be no page errors
