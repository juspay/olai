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

  @scratch:reader
  Scenario: Its code is every file in its folder, and the page shows each one before anything runs
    Given I open the app
    When I go to the plugin "reader"
    Then the plugin page is "review"
    And the plugin page's code tabs are "README.md, server.ts, browser.tsx, columns.tsx, lib/sm2.ts, pairs.ts, types.ts, words.ts"
    And the plugin page's status says "7 files, 291 lines"
    When I open the plugin page's "lib/sm2.ts" tab
    Then the plugin page's code is "lib/sm2.ts"
    And the plugin page's code names "export const scheduled"
    And there should be no page errors

  @scratch:reader
  Scenario: Turned on, a face drawn from three files appears under each sentence
    Given I open the outline "book.olai"
    When I approve the plugin "reader"
    Then the row "s1" draws the French and the English side by side
    And there should be no page errors

  @scratch:reader
  Scenario: An edit to a helper pauses it, and the page shows that file's diff
    Given I open the outline "book.olai"
    When I approve the plugin "reader"
    Then the row "s1" draws the French and the English side by side

    When I go to the plugin "reader"
    And I rewrite "plugins/reader/pairs.ts" as:
      """
      import type { Pair } from "./types.ts"

      /** A `reader-pair` value is the French sentence, ` || `, and its English. */
      export const splitPair = (value: string): Pair | null => {
        const cut = value.indexOf(" || ")
        if (cut <= 0 || cut + 4 >= value.length) return null
        return { french: value.slice(0, cut).trim(), english: value.slice(cut + 4).trim() }
      }
      """
    Then the plugin page is "paused"
    And the plugin page's code is "pairs.ts"
    And the plugin page's diff adds "value.indexOf(\" || \")"
    And the plugin page's diff removes "value.indexOf(\" | \")"
    And the plugin page has disarmed its verbs

    When I read the plugin "reader" again
    And I press the plugin page verb
    Then the plugin page is "on"
    And there should be no page errors

  @scratch:reader
  Scenario: An agent writes a helper, and Delete takes every file
    Given I open the app
    When I go to the plugin "reader"
    And the terminal agent writes "lib/deck.ts" of the plugin "reader" as:
      """
      export const DECK = "vocabulary.olai"
      """
    Then the terminal agent was told the plugin "reader" compiles
    # The page was open when the file landed, so it shows the new file and
    # holds back its verbs until the reader says they have seen it.
    And the plugin page's code tabs are "README.md, server.ts, browser.tsx, columns.tsx, lib/deck.ts, lib/sm2.ts, pairs.ts, types.ts, words.ts"
    And the plugin page has disarmed its verbs

    When I read the plugin "reader" again
    And I delete the plugin "reader" from its page
    Then the vault holds no files for the plugin "reader"
    And there should be no page errors

  @scratch:reader @git:repo
  Scenario: A word clicked in a sentence goes into the vocabulary, through the plugin's own server file
    Given I open the outline "book.olai"
    When I approve the plugin "reader"
    And I press the word "Phileas" under the row "s1"
    Then "vocabulary.olai" has a row titled "Phileas" carrying "reader-due"
    When I open the commit panel
    Then the commit panel lists the outline "vocabulary.olai" with the row "Phileas"
    And "vocabulary.olai" is still waiting in the repository
    And there should be no page errors

  @scratch:reader
  Scenario: Again, Good and Easy write when a word is next due, and leave with the plugin
    Given I open the node "vocabulary"
    When I approve the plugin "reader"
    Then the review offers the word "maison"
    When I grade the word "maison" as "good"
    Then the row "maison" of "vocabulary.olai" is next due after "2026-01-01"

    When I switch the plugin "reader" off on its page
    And I open the node "vocabulary"
    Then the review is not drawn
    And there should be no page errors
