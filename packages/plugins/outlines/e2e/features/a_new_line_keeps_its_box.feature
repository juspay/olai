@share-scratch
@scratch:good
Feature: A new line keeps its box while its save lands
  Type a new line in a ghost and pause: the idle commit fires, and the write's
  reply names the row it made. The frame that DRAWS that row is a subscription
  away, and this whole feature is about the gap between the two.

  It used to be a hole. The editor was drawn from the draft's own kind — a
  pending was a ghost, and the row the write answered with had a `place` of
  `null` until its frame arrived, so for a round trip there was no editor at
  all: the line vanished, the ring jumped to the row above, a fresh input
  retook the caret, and anything typed in between went to the document body.

  The seat is the fix. A line that has landed is drawn where its ghost was —
  the same `<input>`, the same words, the same caret (`edit/draft.ts`'s
  `ghostOf`, on the placing `commit` recorded) — so what a person sees when the
  frame finally arrives is the `•••` beside them going live.

  Scenario: The line is an editor from the first keystroke to the row it becomes
    # NO BACKGROUND, and the hold is why: the socket interceptor has to be in
    # place BEFORE the page opens its subscription (`./undo_delayed_page.feature`
    # is the same shape for the same reason).
    #
    # The frame that draws the new row is HELD OPEN, so the gap is as long as
    # this scenario needs it to be rather than as fast as a server on this
    # machine answers. What the watch is about is the whole of that gap, and a
    # hold is the only way to be sure it saw one.
    Given outline page revisions can be held after their writes reply
    And I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I hold the next outline page revision
    And I watch the line being typed
    And I type "measure twice"
    And "house.olai" holds a node titled "measure twice"
    Then the line being typed never stopped being an editor
    When I release the held outline page revision
    Then the line being typed has become the row holding "measure twice"
    And there should be no page errors

  Scenario: A page's first line keeps its box too
    # `StartLine` draws the same ghost somewhere else — on a page whose tree is
    # empty, outside every `<li>` — and reads the same live line, so it needs
    # the same claim. The hold is what makes the gap in the middle of it long
    # enough to be asked about.
    Given outline page revisions can be held after their writes reply
    And I open the outline "house.olai"
    And I rewrite "empty.olai" as:
      """
      """
    And I open the empty outline "empty.olai"
    When I start the first line
    And I hold the next outline page revision
    And I watch the line being typed
    And I type "the first thing"
    And "empty.olai" holds a node titled "the first thing"
    Then the line being typed never stopped being an editor
    When I release the held outline page revision
    Then the line being typed has become the row holding "the first thing"
    And there should be no page errors

  Scenario: The caret a person left mid-word survives the save landing
    # The reply and the frame swap the BOX under the caret. The offset is the
    # one thing about it that is in neither the draft nor the row — it is in
    # the memory the editor records, keyed by the address the line was typed at
    # — so a box that opens at the end of the text instead is a person thrown to
    # the end of their own sentence.
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I type "measure twice"
    And I put the caret after "measure"
    And "house.olai" holds a node titled "measure twice"
    Then the line being typed has become the row holding "measure twice"
    When I type "-"
    Then "house.olai" holds a node titled "measure- twice"
    And there should be no page errors

  Scenario: A blank does not put the ring on the row it will follow
    # A blank is drawn INSIDE the `<li>` of the row it follows, so its input
    # used to claim that row: the accent ring moved to the line above and the
    # row whose caret is really elsewhere lost it.
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    And I press "Escape"
    When I click the title of "knobs"
    And I click away from the editor
    When I click the first new row
    Then the row "handles" is not pointed at
    And a new row is being typed
    And there should be no page errors
