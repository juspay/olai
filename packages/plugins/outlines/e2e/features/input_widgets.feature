@share-scratch
@scratch:good
Feature: The three input widgets
  Workflowy's three trigger characters, in a row's title: `!` a day in words,
  `#` / `@` a tag the set already uses, `((` a node to place a second copy of.

  One rule underneath all three: what is armed is a function of the TEXT and
  the CARET, so backspacing over the trigger shuts the list and typing it again
  opens the same one. There is no "the picker is open" mode to get out of step
  with the line.

  And one rule about what they WRITE: a tag is text, so it goes into the draft
  and commits with it — but a day and a placement are OPS, sent through the
  same `edit` gate the keys and the agent's tools go through (`outlines_date`,
  `outlines_mirror`). Nothing is echoed: the pill appears and the row appears when
  the file says they did.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A `!` in a title opens the day list, and every row says its day
    When I click the title of "handles"
    And I type " !2026-09-01"
    Then the date completions are open
    And the completions list "2026-09-01"
    And the completion "2026-09-01" says "Tue 1 Sep 2026"

  Scenario: A bare `!` offers the three days a person reaches for
    When I click the title of "handles"
    And I type " !"
    Then the date completions are open
    And the completions list "today, tomorrow, next week"
    And the active completion is "today"
    When I press "ArrowDown"
    Then the active completion is "tomorrow"

  Scenario: Choosing a day sets the date and takes the words back out
    When I click the title of "handles"
    And I type " !2026-09-01"
    And I press "Enter"
    Then the row being typed holds "choose the handles"
    And "house.olai" holds the node "handles" dated "2026-09-01"
    And "house.olai" holds a node titled "choose the handles"
    And no completions are open
    And the page has not reloaded
    And there should be no page errors

  Scenario: The natural-language half, against the clock
    When I click the title of "handles"
    And I type " !tomorrow"
    And I press "Enter"
    Then "house.olai" holds the node "handles" dated tomorrow
    And there should be no page errors

  Scenario: A row that does not exist yet is written first, then dated
    When I click the title of "knobs"
    And I press "Enter"
    And I type "ring the joiner !2026-09-01"
    And I press "Enter"
    Then "house.olai" holds a node titled "ring the joiner"
    And "house.olai" holds a node titled "ring the joiner" dated "2026-09-01"
    And the row being typed holds "ring the joiner"
    And there should be no page errors

  Scenario: The caret carries on in the row a day was picked in
    When I click the title of "handles"
    And I type " !2026-09-01"
    And I press "Enter"
    Then "house.olai" holds the node "handles" dated "2026-09-01"
    When I type " and the hinges"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the handles and the hinges"
    And no row is being edited
    And there should be no page errors

  Scenario: A bare `#` shows what this set uses, most used first
    When I click the title of "knobs"
    And I type " #"
    Then the tag completions are open
    And the completions list "#home, #outdoors"

  Scenario: Typing narrows it, and choosing writes the tag verbatim
    When I click the title of "knobs"
    And I type " #ho"
    Then the completions list "#home"
    When I press "Enter"
    Then the row being typed holds "pick the knobs #home"
    And no completions are open
    When I click away from the editor
    Then "house.olai" holds a node titled "pick the knobs #home"
    And there should be no page errors

  Scenario: A tag is a whole word, so a space ends it
    When I click the title of "knobs"
    And I type " #home now"
    Then no completions are open

  Scenario: A tag written in a NOTE is vocabulary too
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","desc":"ask the #hob people about the cut-out"}
      {"id":"knobs","parent":"kitchen","ord":"a2","title":"pick the knobs"}
      """
    Then the node "handles" is not shown
    When I click the title of "knobs"
    And I type " #h"
    Then the tag completions are open
    And the completions list "#hob, #home"

  Scenario: A tag is counted once per node, however often that node writes it
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home #home","desc":"and again #home"}
      {"id":"knobs","parent":"kitchen","ord":"a1","title":"pick the knobs"}
      """
    Then the node "handles" is not shown
    When I click the title of "knobs"
    And I type " #ho"
    Then the completions list "#home"
    And the completion "#home" says "1"

  Scenario: `@` is the other namespace, and it offers only its own
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"ask","parent":"kitchen","ord":"a1","title":"ask @alice about the alcove"}
      {"id":"knobs","parent":"kitchen","ord":"a2","title":"pick the knobs"}
      """
    Then the node "handles" is not shown
    When I click the title of "knobs"
    And I type " @a"
    Then the tag completions are open
    And the completions list "@alice"
    When I select all and type "pick the knobs #h"
    Then the completions list "#home"

  Scenario: An `@` inside a word is an email address
    When I click the title of "knobs"
    And I type " srid@srid"
    Then no completions are open

  Scenario: `((` searches the set, and says where each hit sits
    When I click the title of "knobs"
    And I type " ((compost"
    Then the mirror completions are open
    And the completions include "the compost heap"
    And the completion "the compost heap" sits at "garden.olai · garden #outdoors"

  Scenario: A draft line with nothing else in it BECOMES the mirror
    When I click the title of "knobs"
    And I press "Enter"
    And I type "((compost"
    And the mirror completions are open
    And I press "Enter"
    Then "house.olai" holds a mirror of "compost" under "install"
    And "house.olai" holds no node titled "((compost"
    And there should be no page errors

  Scenario: A line that has words keeps them, and the mirror is the next row
    When I click the title of "knobs"
    And I type " ((compost"
    And the mirror completions are open
    And I press "Enter"
    Then "house.olai" holds a node titled "pick the knobs"
    And "house.olai" holds a mirror of "compost" under "install"
    And the row being typed holds "pick the knobs"
    And there should be no page errors
    When I type " and the hinges"
    And I click away from the editor
    Then "house.olai" holds a node titled "pick the knobs and the hinges"
    And no row is being edited

  Scenario: The placement is drawn, and ⌘Z retires it
    When I click the title of "knobs"
    And I type " ((compost"
    And the mirror completions are open
    And I press "Enter"
    Then "house.olai" holds a mirror of "compost" under "install"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds no mirror of "compost"
    And there should be no page errors

  Scenario: Enter places nothing for a row the search has moved past
    When I click the title of "knobs"
    And I type " ((compost"
    Then the mirror completions are open
    And the completions include "the compost heap"
    When I retype the row as "pick the knobs ((mint" and press Enter at once
    Then the completions include "split the mint"
    And "house.olai" holds no mirror of "compost"
    When I press "Enter"
    Then "house.olai" holds a mirror of "mint" under "install"
    And there should be no page errors

  Scenario: Escape puts the list away and keeps what was typed
    When I click the title of "handles"
    And I type " !tom"
    Then the date completions are open
    When I press "Escape"
    Then no completions are open
    And the row being typed holds "choose the handles !tom"

  Scenario: With no list up, the keys are the row's own again
    When I click the title of "knobs"
    And I type " #zzz"
    Then no completions are open
    When I press "Escape"
    Then no row is being edited
    And "house.olai" holds a node titled "pick the knobs"

  Scenario: A pointer takes a row without losing the caret
    When I click the title of "knobs"
    And I type " #"
    And I choose "#outdoors" from the completions
    Then the row being typed holds "pick the knobs #outdoors"
    And there should be no page errors

  Scenario: Completions paint over a later section heading
    Given I zoom into the node "kitchen"
    When I click the title of "order"
    And I type " !"
    Then the date completions are open
    And the completions take the pointer where they cross the section heading of "install"
    And there should be no page errors
