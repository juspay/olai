@scratch:empty
Feature: A new vault can become useful through the browser

  Scenario: An empty directory says so, and New outline opens the sidebar's box
    # The page's one button is the next step, and the box it opens is the
    # sidebar's own `+` › New outline box — not a second one on the page.
    Given the served directory holds no file at all
    And I open the app
    Then the empty page says "No outlines yet" and nothing more
    And the empty page "No outlines yet" offers "New outline"
    When I mark the page
    And I press "New outline" on the empty page "No outlines yet"
    Then the sidebar is open with the new outline box in it
    And the new outline box has the caret
    When I type "first"
    And I press "Enter"
    Then the address is "/first.olai"
    And the outline list links to "first.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: With the sidebar collapsed to its rail, New outline brings the column back
    Given the served directory holds no file at all
    And I open the app
    When I collapse the sidebar
    And I press "New outline" on the empty page "No outlines yet"
    Then the sidebar is open with the new outline box in it
    And the new outline box has the caret
    And there should be no page errors

  @phone
  Scenario: On a phone, New outline opens the drawer with the box in it
    # The box lives in the sidebar, which on a phone is a drawer that starts
    # shut. Opening the box in a shut drawer would be a press that did nothing
    # anyone could see, so the drawer opens with it.
    Given the served directory holds no file at all
    And I open the app
    When I press "New outline" on the empty page "No outlines yet"
    Then the sidebar is open with the new outline box in it
    And the new outline box has the caret
    When I type "from-the-phone"
    And I press "Enter"
    Then the address is "/from-the-phone.olai"
    And there should be no page errors
  Scenario: Create the first outline, write its first row, and return after reload
    Given I open the app
    And I mark the page
    When I create the outline "first.olai" from the sidebar
    Then the address is "/first.olai"
    When I start the first line
    And I type "the first task in this vault"
    And I click away from the editor
    Then "first.olai" holds a node titled "the first task in this vault"
    And the page has not reloaded
    When I reload the page
    Then the outline list links to "first.olai"
    And the node titled "the first task in this vault" is shown
    And there should be no page errors

  Scenario: Create and edit a document before the vault has any outline
    Given I open the app
    And I mark the page
    When I create the document "first.md" from the sidebar
    Then the address is "/first.md"
    When I retype the document as:
      """
      **the first document in this vault**
      """
    And I save the document
    Then the document renders bold text "the first document in this vault"
    And the page has not reloaded
    When I reload the page
    Then the document renders bold text "the first document in this vault"
    And there should be no page errors

  Scenario: The first externally added outline appears without reloading the empty vault
    Given I open the app
    And I mark the page
    When I rewrite "arrival.olai" as:
      """
      {"id":"arrival","ord":"a0","title":"the first external row"}
      """
    Then the outline list links to "arrival.olai"
    And the node "arrival" is shown
    When I click the title of "arrival"
    And I select all and type "edited after first arrival"
    And I press "Enter"
    And I press "Escape"
    Then "arrival.olai" holds a node titled "edited after first arrival"
    When I remove the served file "arrival.olai"
    And I create the outline "replacement.olai" from the sidebar
    And I start the first line
    And I type "a fresh start"
    And I click away from the editor
    Then "replacement.olai" holds a node titled "a fresh start"
    And the page has not reloaded
    And there should be no page errors
