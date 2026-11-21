@share-scratch
Feature: Wikilinks open the note their name finds
  `[[finishes]]` is a link to the note named `finishes`, in whatever folder it
  lives. Its words are its alias when it has one, a heading after a `#` lands
  on that heading, and a name that finds nothing is marked the way a dead
  standard link is. The served directory is `wikilinks/`, written the way an
  Obsidian vault is.

  @corpus:wikilinks
  Scenario Outline: Each form opens the page its name finds
    Given I open the document "every-form.md"
    When I click the wikilink "<words>"
    Then the address is "<address>"
    And there should be no page errors

    Examples:
      | words                         | address                     |
      | finishes                      | /finishes.md                |
      | rooms/Note                    | /rooms/Note.md              |
      | finishes.md                   | /finishes.md                |
      | the chosen finishes           | /finishes.md                |
      | kitchen-sink > Lists > Nested | /kitchen-sink.md#nested     |
      | finishes > ^abc123            | /finishes.md                |
      | greenhouse                    | /Greenhouse.md              |
      | Café                          | /Caf%C3%A9.md               |
      | paint colours                 | /paint%20colours.md         |
      | report.pdf                    | /reports/report.pdf         |
      | house.olai                    | /house.olai                 |
      | house.olai > kitchen          | /house.olai#kitchen         |
      | the sink table                | /kitchen-sink.md            |

  @corpus:wikilinks
  Scenario: A link with words shows its words, and never its source
    Given I open the document "every-form.md"
    Then the wikilink "the chosen finishes" opens "/finishes.md"
    And the page shows no wikilink source
    And there should be no page errors

  @corpus:wikilinks
  Scenario: A link to a heading lands on the heading
    Given I open the document "every-form.md"
    When I click the wikilink "kitchen-sink > Tables"
    Then the address is "/kitchen-sink.md#tables"
    And the heading "Tables" is in view
    And there should be no page errors

  @corpus:wikilinks
  Scenario: A link to a heading of its own page lands there
    Given I open the document "every-form.md"
    When I click the wikilink "Further down"
    Then the address is "/every-form.md#further-down"
    And the heading "Further down" is in view

  @corpus:wikilinks
  Scenario: Two notes with one name: each link opens the one in its own folder
    Given I open the document "rooms/plan.md"
    When I click the wikilink "Note"
    Then the address is "/rooms/Note.md"
    When I open the document "garden/beds.md"
    And I click the wikilink "Note"
    Then the address is "/garden/Note.md"
    # From the top of the directory neither is nearer, so the first in path
    # order is the one.
    When I open the document "every-form.md"
    Then the wikilink "Note" opens "/garden/Note.md"
    And there should be no page errors

  @corpus:wikilinks
  Scenario: Alt + click opens the note in the pane on the right
    Given I open the document "every-form.md"
    When I alt-click the wikilink "greenhouse"
    Then pane 1 is showing "/Greenhouse.md"
    And there should be no page errors

  @corpus:wikilinks
  Scenario: The note lists every row and document that wikilinks to it
    Given I open the document "finishes.md"
    When I open what points at the document
    Then what points at the document is "Every form, kitchen remodel with finishes"
    And there should be no page errors

  @corpus:wikilinks
  Scenario: A bare name never finds an outline
    Given I open the document "every-form.md"
    Then the wikilink "house" is marked unresolved
    And the wikilink "house.olai" is not marked unresolved

  @corpus:wikilinks
  Scenario: A click on a link that names nothing reaches the missing page
    Given I open the document "every-form.md"
    Then the wikilink "nowhere" is marked unresolved
    When I click the wikilink "nowhere"
    Then the main pane says there is no document "nowhere.md"
    And there should be no page errors

  @scratch:wikilinks
  Scenario: A link heals when its file is written, and the reader's selection stays
    Given I open the document "every-form.md"
    And I mark the page
    Then the wikilink "nowhere" is marked unresolved
    When I select the words "One line for each way" on the page
    And I rewrite "notes/nowhere.md" as:
      """
      # Nowhere

      It is somewhere now.
      """
    Then the wikilink "nowhere" is not marked unresolved
    And the wikilink "nowhere" opens "/notes/nowhere.md"
    And the words "One line for each way" are still selected
    And the page has not reloaded
    And there should be no page errors

  @scratch:wikilinks
  Scenario: When the namesake beside it leaves or arrives, the link re-aims with no reload
    Given I open the document "garden/beds.md"
    And I mark the page
    Then the wikilink "Note" opens "/garden/Note.md"
    When I remove the served file "garden/Note.md"
    Then the wikilink "Note" opens "/rooms/Note.md"
    When I rewrite "garden/Note.md" as:
      """
      # The garden note, back
      """
    Then the wikilink "Note" opens "/garden/Note.md"
    And the page has not reloaded
    And there should be no page errors

  @scratch:wikilinks
  Scenario: A file a wikilink names cannot be deleted
    Given I open the document "Greenhouse.md"
    When I press Delete file
    And I confirm deleting the file
    Then the deletion is refused saying "`Greenhouse.md` is still named by `every-form.md` (`link`) — deleting the file would leave that pointing at nothing. Re-point it, or delete the naming link or record first."
    And there should be no page errors
