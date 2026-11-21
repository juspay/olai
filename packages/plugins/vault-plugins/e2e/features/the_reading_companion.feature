Feature: The reading companion
  A vault plugin can draw anywhere a built-in plugin can, and these scenarios
  follow one of them doing it: `reader`, a companion for reading a book in
  French, kept in the `reader/` corpus as an ordinary plugin a person turns on
  at its page.

  Each scenario is about a place in the app the plugin reaches, and each ends
  with the plugin switched off and that place empty again: a face exists only
  while the plugin that registered it is mounted.

  The faces are found by attributes the plugin's own source writes, because a
  plugin a vault defines is not in this build's testid table.

  Scenario: An agent is told every place a face can go, and what each is handed
    Given I open the app
    Then the slot catalog lists "app.header, app.banner, app.viewer, app.mount, sidebar.entry, sidebar.section, app.route, app.keys, app.palette, plugins.row"
    And every slot in the catalog says what its face is handed

  @scratch:reader
  Scenario: Its sidebar section, its chord and its palette row come and go with it
    Given I open the outline "book.olai"
    Then the sidebar draws no reading section

    When I approve the plugin "reader"
    Then the sidebar draws the reading section
    When I follow "Vocabulary" in the reading section
    Then the open file is "vocabulary.olai"

    When I click sidebar file "book.olai"
    And I press "ControlOrMeta+Shift+y"
    Then the open file is "vocabulary.olai"

    When I press the palette shortcut
    And I type "book you are reading" into the palette
    And I choose "Open the book you are reading" from the palette
    Then the open file is "book.olai"

    When I switch the plugin "reader" off on its page
    Then the sidebar draws no reading section
    And pressing "ControlOrMeta+Shift+y" leaves this page where it is
    When I press the palette shortcut
    And I type "book you are reading" into the palette
    Then the palette does not offer "Open the book you are reading"
    And there should be no page errors
