Feature: One tree holds every file, under Files
  The sidebar lists the files olai serves in one tree under one heading,
  **Files**: outlines and every other file together, by name at each level,
  folders and files together. A row says what kind of file it is with its own
  glyph, so there is no second list for documents, no count beside it and no
  second fold to remember. Folders start shut, the open file's folders are
  drawn open, and the folders a reader opened are remembered as before.

  What stays out stays out: the archive, olai's own `_olai/` files (the `olai`
  group below the tree is their home), a kind reached from its own plugin's
  page, and a file no kind claims.

  @corpus:good
  Scenario: Outlines and documents stand in one tree under Files
    Given I open the outline "house.olai"
    Then the file list is headed "Files"
    And the sidebar has no Reference section
    And the outline list links to "house.olai"
    # A document at the top level is a row of the tree, with nothing to open
    # first.
    And the document link "finishes.md" is shown
    And the file tree shows the folder "notes"
    And the folder "notes" is collapsed
    And there should be no page errors

  @scratch:empty
  Scenario: The tree reads by name, folders and files together, and a mixed folder is one folder
    Given I rewrite "b.olai" as:
      """
      {"id":"b-row","ord":"a0","title":"the b outline"}
      """
    And I rewrite "a.md" as:
      """
      # A
      """
    And I rewrite "c.md" as:
      """
      # C
      """
    And I rewrite "box/map.olai" as:
      """
      {"id":"map-row","ord":"a0","title":"the map"}
      """
    And I rewrite "box/notes.md" as:
      """
      # Notes
      """
    When I open the app
    Then the file list's top level reads "a.md, b.olai, box/, c.md"
    And the folder "box" appears once in the file list
    When I expand the folder "box"
    Then the folder "box" in the file list holds "box/map.olai, box/notes.md"
    And there should be no page errors

  @scratch:good
  Scenario: A document opened from a row's link is marked, with only its own folders open
    Given I rewrite "links.olai" as:
      """
      {"id":"see","ord":"a0","title":"see the palette","desc":"[palette](notes/palette.md)"}
      """
    And I open the outline "links.olai"
    Then the open folders in the file list are "none"
    When I follow the document link on "see"
    Then the document open is "notes/palette.md"
    And the file list marks "notes/palette.md" as the open file
    And the open folders in the file list are "notes"
    And there should be no page errors

  # The folders a reader opened are kept under the same key they always were,
  # so a folder opened when its files were in a list of their own is still
  # open in the one tree.
  @scratch:good
  Scenario: A folder this browser kept open is still open
    Given this browser kept the folder "art" open
    And I open the outline "house.olai"
    Then the folder "art" is expanded
    And the open folders in the file list are "art"
    And there should be no page errors

  @scratch:good
  Scenario: With no outline left, the tree lists the other files and the front page says so
    Given I open the document "finishes.md"
    When I remove the served file "house.olai"
    And I remove the served file "garden.olai"
    And I remove the served file "Daily/2026-08.olai"
    Then the outline list does not link to "house.olai"
    And the outline list has 0 entries
    And the document link "finishes.md" is shown
    And the file tree shows the folder "notes"
    When I open the app
    Then the empty page says "No outlines yet"
    And the document link "finishes.md" is shown
    And there should be no page errors
