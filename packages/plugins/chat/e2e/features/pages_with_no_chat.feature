@scratch:chat
Feature: The pages that have no chat
  Only a node and a note can have a conversation. A whole outline, a file olai
  only shows — a `.csv`, a picture, a PDF — a day, the agenda, the Trash and a
  plugin's page are none of those, so they place no seat, offer no box and are
  never a chat's subject. A row's own chat still unfolds under its row on the
  outline those pages draw, which is the one conversation an outline page has
  anything to do with.

  Scenario Outline: An outline page offers no chat on <screen>
    Given I open the outline "house.olai"
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

    Examples:
      | screen  |
      | desktop |
    @phone
    Examples:
      | screen |
      | phone  |

  Scenario: A row's own chat still unfolds under its row on that outline
    Given I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I ask the agent "just this row"
    Then the agent's answer mentions "you said: just this row"
    And the page has no chat seat
    And there should be no page errors

  Scenario: A table, a picture and the pages that are not files have no seat either
    Given the vault holds "data/sales.csv" saying "month,sold\nJan,12\nFeb,15"
    When I open the address "/data/sales.csv"
    Then the document open is "data/sales.csv"
    And the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the day "2026-08-10"
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the agenda
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the Trash
    Then the page has no chat seat
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

  # THE FRONT PAGE IS AN OUTLINE, whichever one it turned out to be, and a row
  # landing inside one is still that outline: neither can hold a chat.
  Scenario: The home address and a row landing are outlines, so neither has a seat
    Given I open the address "/"
    Then the page has no chat seat
    When I open the address "/house.olai#install"
    Then the page has no chat seat
    And there should be no page errors
