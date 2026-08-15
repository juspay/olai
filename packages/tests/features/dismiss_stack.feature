@corpus:good
Feature: Dismiss is one stack, and the topmost answers
  Two panels can be up at once, and a gesture that puts panels away has to
  choose ONE of them. Until this feature existed nothing chose: the `•••` menu
  shut inside `@kobalte/core`'s own layer stack and the panels this client
  draws itself shut through the same library's primitives reached one level
  down (`web/src/client/dismiss.ts`), and the two knew nothing about each
  other. So an Escape with both up shut BOTH — which is not two dismissals, it
  is one keystroke landing twice, and the second panel going with the first is
  a panel nobody put away.

  Everything dismissable in this client is on one stack now (`client/topmost.ts`
  lists them): the header's two popovers, a row's expanded note, the chat's
  session picker (`the_agent.feature` holds that one) and its slash list, the
  ⌘K palette, and the menu — which joins the stack rather than keeping its own.
  **The last thing opened is the thing a gesture is for**, and the one under it
  is still there for the next gesture, which is what a person pressing Escape
  twice means by it.

  ## Why the menu is opened with the KEYBOARD here

  Not for the keyboard's sake: it is the only door that does not shut the
  popover on the way through. Opening a menu with the `•••` is a pointer down
  outside the panel that is already up, so the popover is correctly gone before
  the menu is there — one panel at a time, and nothing to choose between. A
  press of Enter on a focused `•••` is not a press anywhere, so it leaves what
  was open open. That is what made this path unwalkable while the bug was live
  and is what walks it now.

  The palette needs no such care, which is why it is here too: `⌘K` fires with
  the caret in a text field, so it opens over whatever was up without a press
  anywhere. That pair was reachable in two keystrokes the whole time.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: Escape shuts the panel on top, and the next Escape the one under it
    When I open the preferences
    And I open the node menu of "kitchen" with the keyboard
    Then the preferences are open
    And the node menu is open
    # ONE panel goes. The menu was opened last, so the menu is what Escape is
    # about; the preferences are still there because nobody asked for them to
    # go.
    When I press "Escape"
    Then the node menu is closed
    And the preferences are open
    # ...and the next one reaches what is now on top.
    When I press "Escape"
    Then the preferences are shut

  Scenario: A pointer outside follows the same order
    # The same rule, the other gesture. A press outside both panels is a press
    # outside the topmost, and that is the only one it puts away — so the
    # popover underneath survives the press that took the menu off it.
    When I open the preferences
    And I open the node menu of "kitchen" with the keyboard
    Then the preferences are open
    And the node menu is open
    When I click away from the node menu
    Then the node menu is closed
    And the preferences are open
    When I click away from the node menu
    Then the preferences are shut

  Scenario: The command palette is a layer like any other
    # The same defect one surface along, and this pair needs no contrivance at
    # all: ⌘K may fire with the caret in a text field (`client/keys.ts`), so it
    # opens the palette WITHOUT a press anywhere — which is exactly what leaves
    # the popover under it standing. One Escape used to run the popover's
    # handler (on the document) and the palette's (on the window, later in the
    # same bubble), and take both.
    When I open the preferences
    And I press the palette shortcut
    Then the command palette is open
    And the preferences are open
    When I press "Escape"
    Then the command palette is closed
    And the preferences are open
    When I press "Escape"
    Then the preferences are shut

  Scenario: The menu opened FIRST defers to what was opened over it
    # THE OTHER ORDER, and the one the menu's own guard exists for. Everything
    # above asks whether a panel stays put while something newer is dismissed;
    # this asks whether the `•••` menu — whose dismissal is Kobalte's rather
    # than this client's — sits an Escape out when the key belongs to a panel
    # above it. It cannot be told to: `MenuContentBase` closes on Escape
    # whether or not the event was prevented, so the refusal is on the menu's
    # own open state (`client/menu/Dropdown.tsx`), and this is what holds it.
    #
    # The preferences are opened by KEYBOARD for the same reason the menu is
    # above: a press of the trigger would be a press outside the menu, and the
    # menu would correctly be gone before the panel arrived.
    When I open the node menu of "kitchen" with the keyboard
    And I focus the preferences trigger
    And I press Enter
    Then the preferences are open
    And the node menu is open
    When I press "Escape"
    Then the preferences are shut
    And the node menu is open
    When I press "Escape"
    Then the node menu is closed

  Scenario: ...and to the palette over it
    # The same order with the pair the author's own altitude pass found, which
    # no scenario walked: two layers whose dismissals are BOTH somebody else's
    # — Kobalte's underneath, the palette's own window listener on top.
    When I open the node menu of "kitchen" with the keyboard
    And I press the palette shortcut
    Then the command palette is open
    And the node menu is open
    When I press "Escape"
    Then the command palette is closed
    And the node menu is open
    When I press "Escape"
    Then the node menu is closed

  Scenario: The keyboard-shortcuts dialog answers the key it is about
    # It had one way out — its scrim — and reviewers found it twice. The dialog
    # that TEACHES the keys ignoring the most universal one is the version of
    # that gap worth closing rather than recording: somebody who opened it to
    # learn what this app answers pressed Escape and nothing happened.
    #
    # Nothing stands over it (the palette that opens it closes on the way
    # through, and this covers the page), so its ticket buys nothing yet — it
    # is on the stack so the next thing drawn over a modal does not have to
    # remember this one.
    When I press the palette shortcut
    And I pick the palette item "Keyboard shortcuts"
    Then the shortcuts are showing
    When I press "Escape"
    Then the shortcuts are put away

  Scenario: ...and its scrim puts away only the palette
    # The palette's way out for a pointer is a press on its own scrim, which
    # covers the page — so it is also a press outside every panel underneath.
    When I open the preferences
    And I press the palette shortcut
    Then the command palette is open
    When I press the palette scrim
    Then the command palette is closed
    And the preferences are open
