@share-scratch
Feature: Typing `[[` in a row offers the files a wikilink can name
  The row editor's fourth list, beside the ones `!`, `#`, `@` and `((` open.
  It offers the documents whose name holds what was typed, then every other
  file the directory serves with its suffix, and choosing one writes the
  shortest link that opens that file from this row. The served directory is
  `wikilinks/`, which holds two notes named `Note`.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  @scratch:wikilinks
  Scenario: Typing narrows the list, and Enter writes a link that opens the note
    When I click the title of "shed"
    And I type " with [[fin"
    Then the wikilink completions are open
    And the completions list "finishes"
    When I press "Enter"
    Then the row being typed holds "paint the shed with [[finishes]]"
    And no completions are open
    When I click away from the editor
    Then "house.olai" holds a node titled "paint the shed with [[finishes]]"
    And the title of "shed" links to "/finishes.md"
    When I click the wikilink "finishes"
    Then the address is "/finishes.md"
    And the page has not reloaded
    And there should be no page errors

  @scratch:wikilinks
  Scenario: Of two notes with one name, choosing the one further away writes its path
    When I click the title of "shed"
    And I type " [[Note"
    Then the completions list "Note, Note"
    When I press "ArrowDown"
    And I press "Enter"
    Then the row being typed holds "paint the shed [[rooms/Note]]"
    When I click away from the editor
    Then the title of "shed" links to "/rooms/Note.md"
    When I click the wikilink "rooms/Note"
    Then the address is "/rooms/Note.md"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: Choosing an outline writes its suffix
    When I click the title of "shed"
    And I type " [[house."
    Then the completions list "house.olai"
    When I press "Enter"
    Then the row being typed holds "paint the shed [[house.olai]]"
    When I click away from the editor
    Then the title of "shed" links to "/house.olai"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: Escape closes the list and keeps what was typed
    When I click the title of "shed"
    And I type " [[fin"
    Then the wikilink completions are open
    When I press "Escape"
    Then no completions are open
    And the row being typed holds "paint the shed [[fin"
    When I type "ishes]]"
    And I click away from the editor
    Then "house.olai" holds a node titled "paint the shed [[finishes]]"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: Text that matches nothing opens no list, and is kept
    When I click the title of "shed"
    And I type " [[zzz"
    Then no completions are open
    When I click away from the editor
    Then "house.olai" holds a node titled "paint the shed [[zzz"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: Inside an open `[[` no other list opens
    When I click the title of "shed"
    And I type " [[#he"
    Then no completions are open
    When I select all and type "[[a !tom"
    Then no completions are open
    And there should be no page errors

  @scratch:wikilinks
  Scenario: The list follows the directory while it is open
    When I click the title of "shed"
    And I type " [[colour"
    Then the completions list "paint colours"
    When I rewrite "notes/colours of the barn.md" as:
      """
      # Colours of the barn
      """
    Then the completions list "colours of the barn, paint colours"
    When I remove the served file "paint colours.md"
    Then the completions list "colours of the barn"
    When I press "Enter"
    Then the row being typed holds "paint the shed [[colours of the barn]]"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: The list is reached by the keyboard alone, and announced as the other lists are
    When I click the title of "shed"
    And I type " [[o"
    Then the wikilink completions are open
    And the completions are announced as a list named "Suggestions"
    And the active completion is "Greenhouse"
    When I press "ArrowDown"
    Then the active completion is "every-form"
    When I press "ArrowUp"
    Then the active completion is "Greenhouse"
    When I press "Enter"
    Then the row being typed holds "paint the shed [[Greenhouse]]"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: The list stays usable when the editor is rebuilt
    When I click the title of "shed"
    And I type " [[fin"
    Then the wikilink completions are open
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I close the plugins panel
    And I use the original browser tab
    Then chat controls are gone-from the outline
    And the wikilink completions are open
    And the completions list "finishes"
    When I press "Enter"
    Then the row being typed holds "paint the shed [[finishes]]"
    And the page has not reloaded
    And there should be no page errors

  @scratch:wikilinks
  Scenario: Confirming text composed with an input method does not choose an offer
    When I click the title of "shed"
    And I type " [["
    And I start composing the IME text "fin" in the focused field
    Then the completions list "finishes"
    When I confirm the IME text "fin" in the focused field
    Then the row being typed holds "paint the shed [[fin"
    And the completions list "finishes"
    When I press "Enter"
    And I click away from the editor
    Then "house.olai" holds a node titled "paint the shed [[finishes]]"
    And there should be no page errors
