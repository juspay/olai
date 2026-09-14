Feature: The ••• menu on the agenda and a day's page
  A task that slipped was found on the agenda and had to be fixed somewhere
  else: open the outline it lives in, find the row, and use ITS menu. The agenda
  is where the question "what do I owe" is asked, so it is where the answer is
  acted on — complete it, move it to another day, put it away.

  A dated row wears the tree row's `•••`, through the same two doors (the `•••`
  beside the bullet on a pointer device, a finger held on the row on a phone),
  and the same catalog asked of the same node. Every verb is the one op it is
  in the outline, through the same write gate, and nothing is echoed: the row
  moves when the file says it moved — to another day, or off the page.

  What a place in an outline has and a node collected from all over the set
  does not is not offered: there is nothing under the row to fold or copy, the
  move-to picker follows a place in a tree, and the row's run of chips is
  read-only.

  @corpus:agenda
  Scenario: An agenda row offers the node's verbs, and none a tree row alone has
    When I open the agenda
    And I open the node menu of "posts"
    Then the node menu offers "Zoom in"
    And the node menu offers "Copy link to node"
    And the node menu offers "Pin to sidebar"
    And the node menu offers "Mark doing"
    And the node menu offers "Complete"
    And the node menu offers "Change date…"
    And the node menu offers "Set repeat…"
    And the node menu offers "Link to a node…"
    And the node menu offers "Wait for a node…"
    And the node menu offers "Duplicate"
    And the node menu offers "Move to Trash"
    And the node menu does not offer "Move to…"
    And the node menu does not offer "Copy as text"
    And the node menu does not offer "Collapse all"
    And the node menu does not offer "Add property…"
    And there should be no page errors

  @corpus:agenda
  Scenario: The ••• hangs beside the bullet, and the row does not move for it
    When I open the agenda
    Then the node menu of "posts" is hidden
    And the ••• of "posts" hangs left of its bullet
    When I hover the node "posts"
    Then the node menu of "posts" is revealed

  @scratch:agenda
  Scenario: Completing a task from the agenda takes it off the agenda
    Given I open the agenda
    And I mark the page
    When I open the node menu of "posts"
    And I choose "Complete" from the node menu
    Then the agenda does not list "posts"
    And "work.olai" holds a node marked done titled "dig the post holes"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: Changing a date from the agenda moves the row to that day
    Given I open the agenda
    And I mark the page
    When I open the node menu of "posts"
    And I choose "Change date…" from the node menu
    Then the date picker is open
    And the date picker holds "2019-11-05"
    And the node menu of "posts" says nothing
    When I pick the date "2019-11-01"
    Then "work.olai" holds the node "posts" dated "2019-11-01"
    And the spine's "late" days are "2019-10-30, 2019-11-01, 2019-11-03"
    And the spine's "late" rows are "permit, posts, visas"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: Move to Trash asks first, and the row leaves the agenda
    Given I open the agenda
    And I mark the page
    When I open the node menu of "posts"
    And I choose "Move to Trash" from the node menu
    Then the node menu asks "Move “dig the post holes” to the Trash? It keeps its id, and the Trash in the sidebar is where to put it back."
    When I choose "Move to Trash" from the node menu
    Then the agenda does not list "posts"
    When I open the Trash
    Then the Trash lists the node "posts"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: Waiting for a node from the agenda writes the edge, and the row says so
    Given I open the agenda
    And I mark the page
    When I open the node menu of "posts"
    And I choose "Wait for a node…" from the node menu
    Then the after panel is open on "posts"
    When I search the edge panel for "permit"
    And I choose "pull the permit" from the edge panel
    Then "work.olai" holds the node "posts" after "permit"
    And the node "posts" is blocked by "permit"
    And the page has not reloaded
    And there should be no page errors

  @scratch:agenda
  Scenario: A refusal is said beside the row, in the ops layer's own words
    # `visas` waits on `photos`, which is not finished: starting it is the one
    # instruction the order forbids, and the agenda hears it verbatim.
    Given I open the agenda
    When I open the node menu of "visas"
    And I choose "Mark doing" from the node menu
    Then the node menu of "visas" says "`send the visa forms` comes after 1 unfinished task, so it cannot start yet: `get passport photos` (`photos`, doing). Finish that first — or start what is ready."
    And the node "visas" has status "todo"

  @scratch:agenda
  Scenario: A day's page wears the same menu
    Given I open the day "2019-11-05"
    And I mark the page
    When I open the node menu of "posts"
    And I choose "Mark doing" from the node menu
    Then the node "posts" has status "doing"
    And "work.olai" holds a node marked doing titled "dig the post holes"
    And the page has not reloaded
    And there should be no page errors

  @corpus:agenda @phone
  Scenario: On a phone, a finger held on an agenda row opens its menu
    When I open the agenda
    Then the node menu of "posts" is not on the row
    When I hold a finger on the node "posts"
    Then the node menu is open
    And the node menu offers "Complete"
    And the node menu offers "Change date…"
