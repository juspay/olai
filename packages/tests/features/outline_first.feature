@share-scratch
Feature: Outlines are the map and Reference holds the material
  @corpus:good
  Scenario: Reference starts folded and remembers its open state
    Given I open the outline "house.olai"
    Then the reference section is collapsed
    And the reference section lists 10 files
    And the outline tree omits the folder "notes"
    When I expand the reference section
    Then the reference section is expanded
    When I reload the page
    Then the reference section is expanded
    When I collapse the reference section
    And I reload the page
    Then the reference section is collapsed

  @scratch:good
  Scenario: A mixed folder appears in both trees
    Given I rewrite "notes/map.olai" as:
      """
      {"id":"map","ord":"a0","title":"Map"}
      """
    And I open the outline "house.olai"
    When I expand the reference section
    Then the folder "notes" appears in both sidebar trees
    When I expand the folder "notes"
    Then the outline list links to "notes/map.olai"
    And the document link "notes/palette.md" is shown

  @corpus:good
  Scenario: Following a node's note opens Reference and selects the document
    Given I open the outline "house.olai"
    Then the reference section is collapsed
    When I follow the document link on "install"
    Then the document open is "finishes.md"
    And the reference section is expanded
    And Reference marks "finishes.md" as the open file

  @scratch:good
  Scenario: A directory with no user outlines still lists its reference files
    Given I open the document "finishes.md"
    When I remove the served file "house.olai"
    And I remove the served file "garden.olai"
    And I remove the served file "Daily/2026-08.olai"
    Then the outline list has 0 entries
    And the reference section lists 10 files

  @scratch:good
  Scenario: A directory with only outlines has no Reference header
    Given I open the outline "house.olai"
    When I remove the served file "finishes.md"
    And I remove the served file "notes/palette.md"
    And I remove the served file "kitchen-sink.md"
    And I remove the served file "quarter.html"
    And I remove the served file "report.html"
    And I remove the served file "reports/q3.pdf"
    And I remove the served file "data/sales.csv"
    And I remove the served file "art/handle.png"
    And I remove the served file "art/tall.png"
    And I remove the served file "art/diagram.svg"
    Then there is no reference section
    And the outline list has 2 entries

  @scratch:good
  Scenario: A new document opens Reference and its folder chain
    Given I open the outline "house.olai"
    Then the reference section is collapsed
    When I create the document "new/brief" from the sidebar
    Then the document open is "new/brief.md"
    And the reference section is expanded
    And the document link "new/brief.md" is shown
    And Reference marks "new/brief.md" as the open file
