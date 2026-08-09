@corpus:good
Feature: Serve a directory
  Olai is pointed at one directory and serves what it finds there. Every
  `.jsonl` under it is an independent outline, and the sidebar is the whole of
  "what did it find" — so this is the first thing that has to be true, and the
  cheapest thing to be wrong about (a mis-globbed extension, a path that reads
  as absolute in the browser and relative on disk).

  Scenario: The app mounts
    When I open the app
    Then the outline list is shown
    And there should be no page errors

  Scenario: Every outline in the directory is listed
    When I open the app
    Then the outline list has 2 entries
    And the outline list links to "garden.jsonl"
    And the outline list links to "house.jsonl"

  Scenario: Documents are not outlines
    # finishes.md is served — `install` attaches it — but it is a document, not
    # an outline, so it is not a tree anybody can open from the sidebar.
    When I open the app
    Then the outline list does not link to "finishes.md"
