@scratch:good
@rows-on:test-palette
Feature: Levels in the command palette
  A command that needs two or three things — where, what, with which agent —
  asks for them in the palette's own box. A row can OPEN A LEVEL: its children
  replace the list, a crumb for it leads the box, and the box filters them. A
  VALUE LEVEL makes the box a line of text with exactly one option chosen
  beside it. Backspace on an empty box, or a press on a crumb, goes back.

  The rows here are the `test-palette` fixture's, contributed through the same
  `paletteAdapters` location every plugin uses, and its `showAt` is the
  declared `navigation.palette` service.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: Enter opens a level; its crumb leads the box, which empties and filters the level's rows
    When I press the palette shortcut
    Then the palette path is ""
    When I type "test lev" into the palette
    And I press "Enter"
    Then the palette path is "test-levels"
    And the palette crumbs read "Test levels"
    And the palette box holds ""
    And the palette placeholder is "Pick a fixture row…"
    And the palette rows are "test-apple, test-banana, test-citrus, test-lookup, test-note, test-late"
    And the palette sections are "Fruit, Nested"
    And the palette row "test-apple" is placed "orchard"
    And the palette footer mentions "back"
    And the palette announces "Test levels"
    And the palette box has the caret
    When I type "an" into the palette
    Then the palette rows are "test-banana"
    And the palette sections are "Fruit"
    When I type "nothing like it" into the palette
    Then the palette rows are ""
    When I type "" into the palette
    And I press "Enter"
    Then the palette remarks "Picked Apple."
    And the palette path is "test-levels"
    When I type "banana" into the palette
    And I press "Enter"
    Then the command palette is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: A press opens a level, a nested level adds a second crumb, and Backspace and the crumbs go back
    When I press the palette shortcut
    And I type "test levels" into the palette
    And I press the palette row "test-levels"
    Then the palette path is "test-levels"
    And the palette box has the caret
    When I press the palette row "test-citrus"
    Then the palette path is "test-levels, test-citrus"
    And the palette crumbs read "Test levels, Citrus"
    And the palette rows are "test-lemon, test-lime"
    And the palette announces "Test levels, Citrus"
    And the palette box has the caret
    When I type "li" into the palette
    Then the palette rows are "test-lime"
    When I press "Backspace"
    Then the palette box holds "l"
    And the palette path is "test-levels, test-citrus"
    When I press "Backspace"
    Then the palette box holds ""
    And the palette path is "test-levels, test-citrus"
    When I press "Backspace"
    Then the palette path is "test-levels"
    And the palette box holds ""
    And the palette announces "Test levels"
    And the palette box has the caret
    When I press the palette row "test-citrus"
    And I press the palette crumb "test-citrus"
    Then the palette path is "test-levels"
    And the palette box has the caret
    When I press the palette row "test-citrus"
    And I press the palette crumb "test-levels"
    Then the palette path is ""
    And the palette announces "All commands"
    And the palette box has the caret
    And the palette offers "Test levels"
    And there should be no page errors

  Scenario: Escape closes from inside a level, and the palette reopens at the root
    When I press the palette shortcut
    And I type "test levels" into the palette
    And I press "Enter"
    And I press the palette row "test-citrus"
    Then the palette path is "test-levels, test-citrus"
    When I press "Escape"
    Then the command palette is closed
    When I press the palette shortcut
    Then the palette path is ""
    And the palette box holds ""
    And the palette offers "Go to Trash"
    And there should be no page errors

  Scenario: At the root a level is found by its own label, and its children are not
    When I press the palette shortcut
    And I type "Citrus" into the palette
    Then the palette does not offer "Citrus"
    When I type "Test levels" into the palette
    Then the palette offers "Test levels"
    And there should be no page errors

  Scenario: A level whose rows are a function of what is typed
    When the fixture opens the palette at "test-levels, test-lookup"
    Then the command palette is open
    And the palette path is "test-levels, test-lookup"
    And the palette rows are ""
    And the palette hint says "Type to find a word"
    When I type "b" into the palette
    Then the palette rows are "test-word-basil, test-word-beacon"
    And the palette sections are "Words"
    When I type "co" into the palette
    Then the palette rows are "test-word-cobalt, test-word-copper"
    When I press "ArrowDown"
    And I press "Enter"
    Then the palette remarks "Picked copper."
    And there should be no page errors

  Scenario: A value level takes a line and exactly one option, and typing never filters the options
    When I press the palette shortcut
    And I type "test levels" into the palette
    And I press "Enter"
    And I type "note" into the palette
    And I press "Enter"
    Then the palette path is "test-levels, test-note"
    And the palette box holds "draft"
    And the palette options are "plain, urgent, quiet"
    And the palette option "urgent" is chosen
    And the palette sections are "Tone"
    And the palette hint says "The tone is chosen with the arrows"
    And the palette footer mentions "Save note"
    And the palette options are a radio group named "Write a note"
    And the palette box has the caret
    When I type "" into the palette
    Then the palette placeholder is "Write a note…"
    When I press "ArrowDown"
    Then the palette option "quiet" is chosen
    When I press "ArrowDown"
    Then the palette option "plain" is chosen
    When I press "ArrowUp"
    Then the palette option "quiet" is chosen
    # A prefix character inside a level is text: `+` is not read.
    When I type "say + > hello" into the palette
    Then the palette options are "plain, urgent, quiet"
    And the palette option "quiet" is chosen
    And the palette path is "test-levels, test-note"
    When I press "Enter"
    Then the palette remarks "Noted “say + > hello” as Quiet."
    And the palette path is "test-levels, test-note"
    And the palette level is not busy
    When I type "keep going" into the palette
    And I press "Enter"
    Then the fixture's notes are "say + > hello/quiet; keep going/quiet"
    And the command palette is open
    And the palette path is "test-levels, test-note"
    And the palette has no write response
    When I type "plain words" into the palette
    And I press "Enter"
    Then the command palette is closed
    And the fixture's notes are "say + > hello/quiet; keep going/quiet; plain words/quiet"
    And there should be no page errors

  Scenario: The validator refuses in place, and a slow submit is busy and takes one Enter
    When the fixture opens the palette at "test-levels, test-note" with ""
    Then the palette box holds ""
    When I press "Enter"
    Then the palette refuses with "Type a note first."
    And the palette path is "test-levels, test-note"
    And the fixture's notes are ""
    When I type "hold this" into the palette
    And I press "Enter"
    Then the palette level is busy
    And the fixture has 1 held note
    When I press "Enter"
    Then the fixture's notes are "hold this/urgent"
    And the fixture has 1 held note
    When the fixture answers its held notes saying "Held note landed."
    Then the palette remarks "Held note landed."
    And the palette level is not busy
    When I type "hold again" into the palette
    And I press the palette submit
    Then the palette level is busy
    When the fixture answers its held notes with nothing to say
    Then the command palette is closed
    And there should be no page errors

  Scenario: Typing, moving the choice and a submit going out keep what the level has drawn
    # Each of these is a state change to show, not a new view: the options,
    # their headings, the crumbs, the footer and its submit stay the same
    # elements, and only their attributes and text follow.
    When the fixture opens the palette at "test-levels, test-note" with ""
    And I mark what the palette has drawn
    And I type "hold the same rows" into the palette
    And I press "ArrowDown"
    Then the palette option "quiet" is chosen
    And what the palette had drawn is still drawn
    When I press "Enter"
    Then the palette level is busy
    And what the palette had drawn is still drawn
    When the fixture answers its held notes saying "Kept."
    Then the palette remarks "Kept."
    And the palette level is not busy
    And what the palette had drawn is still drawn
    And there should be no page errors

  Scenario: Opening and leaving a nested level keeps the crumbs already drawn
    When the fixture opens the palette at "test-levels"
    And I mark what the palette has drawn
    And I press the palette row "test-citrus"
    Then the palette path is "test-levels, test-citrus"
    And the palette crumb "test-levels" is the one drawn before
    When I press "Backspace"
    Then the palette path is "test-levels"
    And the palette crumb "test-levels" is the one drawn before
    And there should be no page errors

  Scenario: A press on an option submits with that option
    When the fixture opens the palette at "test-levels, test-note" with "say pressed"
    Then the palette box holds "say pressed"
    When I press the palette option "plain"
    Then the palette remarks "Noted “say pressed” as Plain."
    And the palette option "plain" is chosen
    And the palette box has the caret
    And there should be no page errors

  Scenario: A submit that fails says so and keeps the level
    When the fixture opens the palette at "test-levels, test-note" with "fail now"
    And I press "Enter"
    Then the palette says "That didn't work. Try again."
    And the palette path is "test-levels, test-note"
    And the palette level is not busy
    And the only page errors are the fixture's deliberate failure

  Scenario: A submit that answers after its level was popped, or the palette closed, changes nothing
    When the fixture opens the palette at "test-levels, test-note" with "hold popped"
    And I press "Enter"
    Then the palette level is busy
    When I press the palette crumb "test-note"
    Then the palette path is "test-levels"
    When the fixture answers its held notes saying "Too late."
    Then the palette has no write response
    And the palette path is "test-levels"
    And the command palette is open
    When I press the palette row "test-note"
    Then the palette level is not busy
    When I type "hold closed" into the palette
    And I press "Enter"
    Then the palette level is busy
    When I press "Escape"
    Then the command palette is closed
    When I press the palette shortcut
    And the fixture answers its held notes with nothing to say
    Then the command palette is open
    And the palette path is ""
    And the palette has no write response
    And there should be no page errors

  Scenario: The palette opens at a path of row ids, as deep as the path resolves
    When the fixture opens the palette at "test-levels, test-citrus"
    Then the command palette is open
    And the palette path is "test-levels, test-citrus"
    And the palette announces "Test levels, Citrus"
    And the palette box has the caret
    When the fixture opens the palette at "test-levels, test-note" with "carried words"
    Then the palette path is "test-levels, test-note"
    And the palette box holds "carried words"
    When the fixture opens the palette at "test-levels, no-such-row" with "lost words"
    Then the palette path is "test-levels"
    And the palette box holds ""
    When the fixture opens the palette at "test-levels, test-note"
    Then the palette box holds "draft"
    When the fixture withdraws its palette rows
    Then the palette path is ""
    And the palette remarks "“Test levels” is no longer available."
    When the fixture opens the palette at "test-levels, test-note" with "nowhere"
    Then the command palette is open
    And the palette path is ""
    And the palette box holds ""
    And the palette does not offer "Test levels"
    When the fixture restores its palette rows
    Then the palette offers "Test levels"
    And the palette path is ""
    And there should be no page errors

  Scenario: The adapter withdrawn under an open level falls back, its return does not reopen it, and its late answer changes nothing
    When the fixture opens the palette at "test-levels, test-note" with "hold withdrawn"
    And I press "Enter"
    Then the palette level is busy
    When the fixture withdraws its palette rows
    Then the palette path is ""
    And the palette remarks "“Test levels” is no longer available."
    And the palette box holds ""
    When the fixture answers its held notes saying "Too late."
    Then the palette remarks "“Test levels” is no longer available."
    And the command palette is open
    When the fixture restores its palette rows
    Then the palette offers "Test levels"
    And the palette path is ""
    And there should be no page errors

  Scenario: The fixture switched off while its level is open
    When the fixture opens the palette at "test-levels, test-note" with "hold switched"
    And I press "Enter"
    Then the palette level is busy
    When I open another browser tab
    And I open the plugins panel
    And I switch the palette fixture off
    And I close the plugins panel
    And I use the original browser tab
    Then the palette path is ""
    And the palette remarks "“Test levels” is no longer available."
    And the palette does not offer "Test levels"
    When the fixture answers its held notes saying "Too late."
    Then the palette remarks "“Test levels” is no longer available."
    And the command palette is open
    And the page has not reloaded
    And there should be no page errors

  Scenario: A redraw keeps a level opened from rows that arrived late, with its text, option and submit
    # The overlay is layout's, so switching layout off and on draws the palette
    # again with the fixture left standing. What was open is remembered with
    # the level it opened, so a level reached through rows a function lists
    # later is not looked for again among rows that are not there yet.
    When the fixture opens the palette at "test-levels, test-late"
    Then the palette path is "test-levels, test-late"
    And the palette hint says "Rows arrive shortly"
    And the palette rows are "test-late-note"
    When I press the palette row "test-late-note"
    Then the palette path is "test-levels, test-late, test-late-note"
    When I type "hold late" into the palette
    And I press "ArrowDown"
    Then the palette option "quiet" is chosen
    When I press "Enter"
    Then the palette level is busy
    When the settings file switches the row "layout" off
    Then the palette is not drawn
    When the settings file switches the row "layout" on
    Then the command palette is open
    And the palette path is "test-levels, test-late, test-late-note"
    And the palette crumbs read "Test levels, Late rows, Late note"
    And the palette box holds "hold late"
    And the palette option "quiet" is chosen
    And the palette level is busy
    And the palette has no write response
    When the fixture answers its held notes with nothing to say
    Then the command palette is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: An adapter that stops being available under an open level falls back, and its late answer changes nothing
    When the fixture opens the palette at "test-levels, test-note" with "hold unavailable"
    And I press "Enter"
    Then the palette level is busy
    When the fixture makes its palette rows unavailable
    Then the palette path is ""
    And the palette remarks "“Test levels” is no longer available."
    And the palette does not offer "Test levels"
    When the fixture answers its held notes saying "Too late."
    Then the palette remarks "“Test levels” is no longer available."
    And the command palette is open
    When the fixture makes its palette rows available
    Then the palette offers "Test levels"
    And the palette path is ""
    And there should be no page errors

  Scenario: An adapter that stops offering the open level's row falls back, and its late answer changes nothing
    When the fixture opens the palette at "test-levels, test-note" with "hold unoffered"
    And I press "Enter"
    Then the palette level is busy
    When the fixture stops offering its palette row
    Then the palette path is ""
    And the palette remarks "“Test levels” is no longer available."
    And the palette does not offer "Test levels"
    When the fixture answers its held notes saying "Too late."
    Then the palette remarks "“Test levels” is no longer available."
    And the command palette is open
    When the fixture offers its palette row again
    Then the palette offers "Test levels"
    And the palette path is ""
    And there should be no page errors

  Scenario: Prefixes and questions still belong to the root
    Given I open the node "install"
    When I press the palette shortcut
    And I type "test levels" into the palette
    And I press "Enter"
    And I type "+ not a capture" into the palette
    Then the palette rows are ""
    When I press "Enter"
    Then the palette path is "test-levels"
    And the palette box holds "+ not a capture"
    And the palette has no write response
    When I type "" into the palette
    And I press "Backspace"
    Then the palette path is ""
    When I capture "captured at the root" from the palette
    Then "_olai/Inbox.olai" holds a node titled "captured at the root"
    When I type "" into the palette
    And I choose "Move to Trash" from the palette
    Then the palette asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    When I choose "Cancel" from the palette
    Then the palette is not asking anything
    And "house.olai" holds a node titled "install the cabinets"
    And there should be no page errors

  @phone
  Scenario: On a phone the crumb is the way back, and options and submit are pressed
    When I tap the header search
    Then the command palette is open
    When I type "test levels" into the palette
    And I press the palette row "test-levels"
    And I press the palette row "test-citrus"
    Then the palette path is "test-levels, test-citrus"
    When I press the palette crumb "test-citrus"
    Then the palette path is "test-levels"
    When I press the palette row "test-note"
    Then the palette box holds "draft"
    When I type "say from a phone" into the palette
    And I press the palette option "plain"
    Then the palette remarks "Noted “say from a phone” as Plain."
    When I type "phone submit" into the palette
    And I press the palette submit
    Then the command palette is closed
    And the fixture's notes are "say from a phone/plain; phone submit/plain"
    When I tap the header search
    Then the palette path is ""
    And there should be no page errors
