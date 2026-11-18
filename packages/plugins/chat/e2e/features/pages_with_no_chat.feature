@scratch:chat
Feature: The pages that have no chat
  Only a node and a note can have a conversation. A whole outline, a file olai
  only shows — a `.csv`, a picture, a PDF — a day, the agenda, the Trash and a
  plugin's page are none of those, so they draw no line, offer no box and are
  never a chat's subject. A row's own chat still unfolds under its row on the
  outline those pages draw, which is the one conversation an outline page has
  anything to do with.

  Scenario Outline: An outline page offers no chat on <screen>
    Given I open the outline "house.olai"
    Then the page has no chat line
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
    And the page has no chat line
    And there should be no page errors

  # THE PICTURE AND THE PDF ARE OPENED, not named. A page that offers no chat
  # is a claim about a page a person is looking at, and the two file kinds
  # this feature's own first paragraph promises are the two it used to make
  # that claim about without ever drawing: a scenario that only said the
  # words would pass just as well on an address that drew nothing at all.
  Scenario: A table, a picture and the pages that are not files have no line either
    Given the vault holds "data/sales.csv" saying "month,sold\nJan,12\nFeb,15"
    And the vault holds the fixture file "art/handle.png"
    And the vault holds the fixture file "reports/q3.pdf"
    When I open the address "/data/sales.csv"
    Then the document open is "data/sales.csv"
    And the page has no chat line
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    # A PICTURE: its page is drawn — the bytes decoded, so this is the picture
    # and not an empty box where one failed to arrive — and it has no line.
    # REACHED BY ITS ROW rather than by its address: a `.pdf` page hands the
    # file to a viewer the suite's browser does not have, so a RELOAD onto one
    # waits on a `load` event that may never come. The sidebar's own press is
    # how a person gets there anyway.
    And I expand the folder "art"
    And I click the "image" row "art/handle.png"
    Then the picture drawn is "art/handle.png"
    And the picture has loaded
    And the page has no chat line
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    # ...AND A PDF, whose page hands the file to the browser's own viewer.
    And I expand the folder "reports"
    And I click the "pdf" row "reports/q3.pdf"
    Then the pdf drawn is "reports/q3.pdf"
    And the page has no chat line
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the day "2026-08-10"
    Then the page has no chat line
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the agenda
    Then the page has no chat line
    When I press the palette shortcut
    Then the palette offers no chat about this page
    When I press "Escape"
    And I open the Trash
    Then the page has no chat line
    When I press the palette shortcut
    Then the palette offers no chat about this page
    And there should be no page errors

  # THE FRONT PAGE IS AN OUTLINE, whichever one it turned out to be, and a row
  # landing inside one is still that outline: neither can hold a chat.
  Scenario: The home address and a row landing are outlines, so neither has a line
    Given I open the address "/"
    Then the page has no chat line
    When I open the address "/house.olai#install"
    Then the page has no chat line
    And there should be no page errors
