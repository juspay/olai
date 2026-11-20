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

  Scenario: A line being typed takes the ring with it, and nothing else wears it
    Given outline page revisions can be held after their writes reply
    And I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I hold the next outline page revision
    And I type "measure twice"
    And "house.olai" holds a node titled "measure twice"
    Then no row is pointed at
    When I release the held outline page revision
    Then the line being typed has become the row holding "measure twice"
    And the row being typed is the one pointed at
    And there should be no page errors

  Scenario: The bullet and the caret do not move when the line lands
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I write down the boxes of the line being typed
    And I type "measure twice"
    And "house.olai" holds a node titled "measure twice"
    And the line being typed has become the row holding "measure twice"
    Then the row it became stands in the same boxes
    And there should be no page errors

  Scenario: What a row hides until a hand is on it stays hidden while its title is typed
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I press "Enter"
    And I type "measure twice"
    And "house.olai" holds a node titled "measure twice"
    And the line being typed has become the row holding "measure twice"
    And the pointer is off every row
    Then the row being typed hides its furniture
    When I hover the row being typed
    Then the row being typed shows its furniture
    And there should be no page errors

  Scenario: The caret a person left mid-word survives the save landing
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
