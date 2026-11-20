@share-scratch
@scratch:good
Feature: Keyboard editing
  The Workflowy loop, without the agent: click a title and type, Enter for the
  next line, Tab and Shift+Tab for the shape, Alt+Shift+arrows to reorder,
  Ctrl+Enter to tick something off, Ctrl+Shift+Enter to walk the mark on to
  what it is not finished at, Shift+Enter for the note.

  Every one of those is one op through the same write gate the agent's tools go
  through, and nothing is echoed: what you see is the file coming back. Which
  is why these are `@scratch:` — they write the directory they are served.
  They share one copy per worker (`@share-scratch`); the corpus is restored
  between scenarios under the still-running server.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: Typing a title writes it, and the page follows the file
    When I click the title of "handles"
    And I select all and type "choose the brass handles"
    And I press "Enter"
    Then the node "handles" has the title "choose the brass handles"
    And "house.olai" holds a node titled "choose the brass handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A click in a title puts the caret there, not at the end
    When I click the title of "handles" near its start
    Then the caret is near the start of the line
    And the row being typed holds "choose the handles"

  Scenario: A draft is an editor until something commits it
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    Then "house.olai" holds no node titled "pick the little brass knobs"
    And "house.olai" holds a node titled "pick the knobs"
    Then "house.olai" holds a node titled "pick the little brass knobs"
    When I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"

  Scenario: Escape abandons what was typed
    When I click the title of "knobs"
    And I select all and type "something else entirely"
    And I press "Escape"
    Then no row is being edited
    And the node "knobs" has the title "pick the knobs"

  Scenario: Blur commits the draft
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    And I click away from the editor
    Then the node "knobs" has the title "pick the little brass knobs"
    And no row is being edited

  Scenario: Blur commits a BRAND-NEW line, and leaves it too
    When I click the title of "handles"
    And I press "Enter"
    And I type "measure the alcove"
    And I click away from the editor
    Then "house.olai" holds a node titled "measure the alcove"
    And no row is being edited

  Scenario: Enter opens the next row, and it is written when it has a title
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"
    When I type "measure the alcove"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure the alcove"
    And the page has not reloaded

  Scenario: Enter Enter Enter lays out three empty drafts, and writes none of them
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    And I press "Enter"
    Then 3 new rows are being typed
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: Enter at the start of a line inserts a draft above it
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    Then a new row is being typed
    And the row being typed is drawn immediately above the title of "kitchen"
    And the node "kitchen" has the title "kitchen remodel #home"
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: A titled column-0 draft lands above the row it was opened on
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I type "garage"
    And I press "Enter"
    Then "house.olai" holds a node titled "garage"
    And the node titled "garage" comes before "kitchen"

  Scenario: Clicking a parked draft after titling the live one keeps it above
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I type "garage"
    And I click the first new row
    Then "house.olai" holds a node titled "garage"
    And a new row is being typed
    When I type "driveway"
    And I press "Enter"
    Then the node titled "driveway" comes before the node titled "garage"
    And the node titled "garage" comes before "kitchen"

  Scenario: Typing into a parked row while the prior save settles keeps every character
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I type "garage"
    And I focus the first parked row and type "driveway" immediately
    Then "house.olai" holds a node titled "garage"
    And "house.olai" holds a node titled "driveway"
    And the node titled "driveway" comes before the node titled "garage"
    And the node titled "garage" comes before "kitchen"
    And there should be no page errors

  Scenario: Clicking away from empty drafts parks them
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I click the page away from the drafts
    Then 2 new rows are being typed
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: The line being typed sits where the row will sit
    When I click the title of "hinges"
    And I press "Enter"
    Then a new row is being typed
    And the row being typed lines up with the title of "hinges"

  Scenario: The row holding the caret says so
    When I click the title of "handles"
    Then the row "handles" holds the caret
    And no other row holds the caret
    When I press "ArrowDown"
    Then the row "hinges" holds the caret
    And no other row holds the caret

  Scenario: An abandoned empty row writes nothing
    When I click the title of "handles"
    And I press "Enter"
    And I press "Escape"
    Then no row is being edited
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: Backspace deletes the empty blank and aims the caret at the line above
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    When I press "Backspace"
    Then the row being typed holds "choose the handles"
    And the caret is at offset 18
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"
    And there should be no page errors

  Scenario: Backspace over a blank walks a skeleton back up one line at a time
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I press "Backspace"
    Then a new row is being typed
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"
    When I type "measure the alcove"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure the alcove"
    And the node titled "measure the alcove" comes before "hinges"

  Scenario: Tab indents under the row above, and Shift+Tab puts it back
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I press "Shift+Tab"
    Then the node "knobs" is a child of "install"
    And the page has not reloaded

  Scenario: The first of its siblings has nothing to indent under
    When I click the title of "handles"
    And I press "Tab"
    Then the refusal says "no row above to indent under"
    And the node "handles" is a child of "install"
    When I select all and type "choose the brass handles"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the brass handles"

  Scenario: Alt+Shift+Up moves a row among its siblings
    When I click the title of "knobs"
    And I press "Alt+Shift+ArrowUp"
    Then the node "knobs" comes before "hinges"
    And the page has not reloaded

  Scenario: Enter, Tab, a title, Enter writes a child of the row above
    When I click the title of "install"
    And I press "Enter"
    Then a new row is being typed
    When I press "Tab"
    And I type "measure twice"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure twice"
    And "house.olai" holds a node titled "measure twice" under "install"

  Scenario: the Tab seat of a CHILDLESS row is drawn, not air
    When I click the title of "knobs"
    And I press "Enter"
    And I press "Tab"
    Then a new row is being typed
    And the row being typed is drawn immediately above the title of "kitchen-herbs"
    And the row being typed is drawn at the child depth of "knobs"

  Scenario: Tab seats a blank as the last child of the row above, one level in
    When I click the title of "kitchen"
    And I press "Enter"
    And I press "Tab"
    And I type "the mugs go in the old pantry"
    And I press "Enter"
    Then "house.olai" holds a node titled "the mugs go in the old pantry"
    And "house.olai" holds a node titled "the mugs go in the old pantry" under "kitchen"

  Scenario: Tab UNFOLDS the branch it seats a blank in
    When I collapse the node "install"
    And I click the title of "install"
    And I press "Enter"
    And I press "Tab"
    Then the node "install" is expanded
    And a new row is being typed
    When I type "mount the crown moulding"
    And I press "Enter"
    Then "house.olai" holds a node titled "mount the crown moulding" under "install"

  Scenario: Alt+Shift+Up steps past the parked blanks to the row above
    When I click the title of "knobs"
    And I press "Enter"
    And I press "Enter"
    And I press "Enter"
    Then a new row is being typed
    When I press "Alt+Shift+ArrowUp"
    Then a new row is being typed
    And the row being typed is drawn immediately above the title of "knobs"

  Scenario: a blank among rows keeps the outline's line rhythm
    When I click the title of "knobs"
    And I press "Enter"
    Then a new row is being typed
    And the row being typed stands the same line below "knobs" as that row stands below "hinges"

  Scenario: A blank takes Shift+Tab back out, before it is written
    When I click the title of "install"
    And I press "Enter"
    And I press "Tab"
    And I press "Shift+Tab"
    And I type "regrout the bar"
    And I press "Enter"
    Then "house.olai" holds a node titled "regrout the bar"
    And the node titled "regrout the bar" comes before "kitchen-herbs"

  Scenario: Shift+Tab of a line with words keeps the caret in it
    When I click the title of "knobs"
    And I press "Enter"
    And I type "regrout the bar"
    And I press "Shift+Tab"
    Then the node titled "regrout the bar" comes before "kitchen-herbs"
    And the row being typed holds "regrout the bar"
    And the row being typed has the focus
    And no other row holds the caret
    And there should be no page errors

  Scenario: Alt+Shift+Up moves a blank among its would-be siblings
    When I click the title of "knobs"
    And I press "Enter"
    And I press "Alt+Shift+ArrowUp"
    And I type "fetch a mallet"
    And I press "Enter"
    Then "house.olai" holds a node titled "fetch a mallet"
    And the node titled "fetch a mallet" comes before the node titled "pick the knobs"
    And the node titled "pick the hinges" comes before the node titled "fetch a mallet"

  Scenario: Ctrl+Enter ticks a row off, and again takes it back
    When I click the title of "handles"
    And I press "Control+Enter"
    Then the node "handles" has status "done"
    When I press "Control+Enter"
    Then the node "handles" has no status

  Scenario: The mark walk writes the two marks Ctrl+Enter cannot, and takes one off
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "todo"
    When I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I press "Control+Shift+Enter"
    Then the node "handles" has no status
    And "house.olai" holds the node "handles" with no mark
    And the page has not reloaded
    And there should be no page errors

  Scenario: Only the STARTING verb refuses — finishing out of order still lands
    When I click the title of "hinges"
    And I press "Control+Enter"
    Then the node "hinges" has status "done"
    And "house.olai" holds a node marked done titled "pick the hinges"

  Scenario: The keys keep working after the row has moved
    When I click the title of "knobs"
    And I press "Tab"
    And I press "Shift+Tab"
    And I press "Alt+Shift+ArrowUp"
    And I press "Control+Enter"
    Then the node "knobs" has status "done"
    And the row being typed holds "pick the knobs"

  Scenario: A same-task redraw blur cannot close the refocused editor
    When I click the title of "knobs"
    And a DOM reorder briefly removes and refocuses the title editor
    And I press "Control+Enter"
    Then the node "knobs" has status "done"
    And the row being typed holds "pick the knobs"
    And there should be no page errors

  Scenario: An indent leaves the caret where it was in the line
    When I click the title of "knobs"
    And I put the caret after "pick"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    And the row being typed holds "pick the knobs"
    And the caret is at offset 4
    When I press "Shift+Tab"
    Then the node "knobs" is a child of "install"
    And the caret is at offset 4
    When I type " out"
    And I click away from the editor
    Then "house.olai" holds a node titled "pick out the knobs"
    And there should be no page errors

  Scenario: Clicking the note you are reading puts the caret in it
    When I open the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I click the note of "order"
    Then the note of "order" is being typed
    And the note being typed holds the source of "order"
    When I type " — measured twice"
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    And the row "order" is folded

  Scenario: A click on a note's clamped line measures the caret the way a title's click does
    When I click the note of "order" near its end
    Then the note of "order" is being typed
    And the note being typed holds the source of "order"
    And the note's caret is at offset 15
    When I press "Escape"
    And I click the note of "order" near its start
    Then the note of "order" is being typed
    And the note's caret is at offset 0
    When I press "Escape"
    Then there should be no page errors

  Scenario: Shift+Enter writes the note, and the rendering comes back
    When I click the title of "handles"
    And I press "Shift+Enter"
    Then the note of "handles" is being typed
    When I type "the alcove is **1830mm** wide"
    And I press "Shift+Enter"
    Then the note of "handles" is no longer being typed
    And the row "handles" is folded
    And "house.olai" holds a node whose note ends "wide"
    When I click away from the editor
    Then the node "handles" shows a pilcrow

  Scenario: A write that lands can have something to say
    Given I open the outline "garden.olai"
    And I show the done nodes
    When I click the title of "mint"
    And I mark every element of the row "mint"
    And I press "Control+Enter"
    Then the node "mint" has status "done"
    And the nudge says "every task under"
    And the nudge is announced politely
    And the row "mint" was read out loud 1 time
    When I type "!"
    Then nothing is being said about the row
    And the row "mint" was read out loud 1 time

  Scenario: A refused write keeps the draft and says why
    When I click the title of "handles"
    And I select all and type ""
    And I click away from the editor
    Then the refusal says "a node needs a title"
    And the refusal is announced at once
    And the row being typed holds ""
    And "house.olai" holds a node titled "choose the handles"

  Scenario: A refusal belongs to the row that caused it
    When I click the title of "handles"
    And I select all and type ""
    And I click the title of "knobs"
    Then the refusal says "a node needs a title"
    And the row being typed holds ""
    And "house.olai" holds a node titled "pick the knobs"

  Scenario: Two refusals in a row leave the editor working
    When I click the title of "handles"
    And I press "Tab"
    Then the refusal says "no row above to indent under"
    When I press "Tab"
    Then the refusal says "no row above to indent under"
    When I select all and type "choose the brass handles"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the brass handles"

  Scenario: The keys keep up with a person typing faster than the wire
    When I click the title of "knobs"
    And I press "Tab" without waiting
    And I press "Alt+Shift+ArrowUp" without waiting
    And I press "Control+Enter" without waiting
    Then the node "knobs" is a child of "hinges"
    And the node "knobs" has status "done"
    And there should be no page errors

  Scenario: The arrows move the caret between rows
    When I click the title of "handles"
    And I press "ArrowDown"
    Then the row being typed holds "pick the hinges"
    When I press "ArrowUp"
    Then the row being typed holds "choose the handles"

  Scenario: Up and down carry the column, and a shorter line clamps it
    When I click the title of "handles"
    And I put the caret after "choose the handles"
    And I press "ArrowDown"
    Then the row being typed holds "pick the hinges"
    And the caret is at offset 15
    When I press "ArrowDown"
    Then the row being typed holds "pick the knobs"
    And the caret is at offset 14
    When I press "ArrowUp"
    Then the row being typed holds "pick the hinges"
    And the caret is at offset 14

  Scenario: Left at the start and right at the end cross into the line beside
    When I click the title of "order"
    And I put the caret at the start of the line
    And I press "ArrowLeft"
    Then the row being typed holds "take out the old counters"
    And the caret is at offset 25
    When I press "ArrowRight"
    Then the row being typed holds "order the new cabinets"
    And the caret is at offset 0

  Scenario: The arrows cross a blank draft the way they cross a row
    When I click the title of "order"
    And I put the caret after "order the new cabinets"
    And I press "Enter"
    Then a new row is being typed
    When I press "ArrowUp"
    Then the row being typed holds "order the new cabinets"
    And a new row is being typed
    When I press "ArrowDown"
    Then a new row is being typed
    When I type "mid sentence"
    And I press "Enter"
    Then "house.olai" holds a node titled "mid sentence"
    And the node titled "mid sentence" comes before the node titled "install"
    When I press "Escape"
    Then there should be no page errors

  Scenario: Enter on a mirror makes a sibling of the PLACEMENT
    When I click the title of "kitchen-herbs"
    And I press "Enter"
    And I type "and one after the mirror"
    And I click away from the editor
    Then "house.olai" holds a node titled "and one after the mirror"
    And "garden.olai" holds no node titled "and one after the mirror"

  Scenario: A zoomed node with nothing under it offers the first child
    When I open the node "knobs"
    And I start the first line
    And I type "brushed steel, maybe"
    And I click away from the editor
    Then "house.olai" holds a node titled "brushed steel, maybe"
    And the tree is shown
    And no row is being edited

  Scenario: An outline that holds nothing offers its first line
    When I rewrite "empty.olai" as:
      """
      """
    And I open the empty outline "empty.olai"
    And I start the first line
    And I type "the first thing"
    And I click away from the editor
    Then "empty.olai" holds a node titled "the first thing"
    And no row is being edited

  Scenario: A skeleton on an empty outline survives the first title
    When I rewrite "empty.olai" as:
      """
      """
    And I open the empty outline "empty.olai"
    And I start the first line
    And I press "Enter"
    And I press "Enter"
    Then 3 new rows are being typed
    When I type "the first thing"
    And I press "Enter"
    Then "empty.olai" holds a node titled "the first thing"
    And 3 new rows are being typed

  Scenario: A skeleton under an empty node survives the first title
    When I open the node "knobs"
    And I start the first line
    And I press "Enter"
    And I press "Enter"
    Then 3 new rows are being typed
    When I type "brushed steel"
    And I press "Enter"
    Then "house.olai" holds a node titled "brushed steel"
    And 3 new rows are being typed
