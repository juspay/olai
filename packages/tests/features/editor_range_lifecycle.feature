@scratch:good
Feature: A rebuilt editor preserves the selected text before a structural key
  Scenario: Splitting after a rebuild removes the selected text and keeps both outside halves
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I select "the" in the line
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    And the selected text in the line is "the"
    When I press "Enter"
    Then "house.olai" holds a node titled "choose "
    And "house.olai" holds a node titled " handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Typing after a rebuild replaces only the selected word
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I select "the" in the line
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    And the selected text in the line is "the"
    When I type "brass"
    And I click away from the editor
    And I press "Escape"
    Then "house.olai" holds a node titled "choose brass handles"
    When I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A connection outage leaves the selected word available for replacement
    Given I open the outline "house.olai"
    And I mark the page
    When I click the title of "handles"
    And I select "the" in the line
    And the browser goes offline
    Then the connection is "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the overlay is gone
    And the selected text in the line is "the"
    When I type "copper"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose copper handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A note retains a backward selection through rebuilding and saves only its replacement
    Given I rewrite "note-range.olai" as:
      """
      {"id":"note-range","ord":"a0","title":"a note to edit","desc":"first line\nchoose the handles"}
      """
    And I open the outline "note-range.olai"
    And I mark the page
    When I open the note of "note-range"
    And I click the note of "note-range"
    And I select "the" backwards in the note
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    And the note retains the backward selection "the"
    When I type "brass"
    And I click away from the editor
    Then "note-range.olai" holds a node whose note ends "choose brass handles"
    When I press "ControlOrMeta+z"
    Then "note-range.olai" holds a node whose note ends "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Typing and arrow movement in a note survive rebuilding its editor
    Given I rewrite "note-caret.olai" as:
      """
      {"id":"note-caret","ord":"a0","title":"a note to continue","desc":"first line\nchoose the handles"}
      """
    And I open the outline "note-caret.olai"
    And I mark the page
    When I open the note of "note-caret"
    And I click the note of "note-caret"
    And I type " and more"
    And I press "ArrowLeft"
    And I press "ArrowLeft"
    And I press "ArrowLeft"
    And I press "ArrowLeft"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then the conversation is gone-from the header
    When I type "even "
    And I click away from the editor
    Then "note-caret.olai" holds a node whose note ends "choose the handles and even more"
    When I press "ControlOrMeta+z"
    Then "note-caret.olai" holds a node whose note ends "choose the handles"
    And the page has not reloaded
    And there should be no page errors
