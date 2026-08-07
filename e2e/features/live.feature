Feature: the outline, live

  The page watches the file it was drawn from. Whoever saves it — an editor,
  an agent, `olai add` — every open page follows within a couple of seconds,
  and nobody reloads anything.

  Scenario: a title saved to the file shows up on a page nobody touched
    When I open the home page
    And I mark this page load
    And I add the title "Water the plants" to the outline
    Then I see the title "Water the plants"
    And the page has not reloaded

  Scenario: a title deleted from the file leaves the page the same way
    When I open the home page
    Then I see the title "Write the tests"
    And I mark this page load
    And I remove the title "Write the tests" from the outline
    Then "Write the tests" leaves the page
    And I see the title "Ship the server"
    And the page has not reloaded

  # And the file the page follows does not have to exist when the page is
  # drawn. `@include Daily/*.rkt` names a DIRECTORY's worth of fragments, so
  # the first one of a new month arriving is a change with nothing in it that
  # the server had already read — no mtime moved, nothing was saved over. The
  # pattern is what gets asked again (docs/syntax.md, Globs).

  Scenario: a file appearing in a glob's directory joins the outline
    Given a fragment "Daily/2026-01.rkt" holding "January standup"
    When I open the home page
    And I mark this page load
    And the outline includes the fragments in "Daily/*.rkt"
    Then I see the title "January standup"
    When a fragment "Daily/2026-02.rkt" appears holding "February standup"
    Then I see the title "February standup"
    And the page has not reloaded

  # The sidebar tree draws the same node titles the outline does, from the same
  # file. It is a SECOND live region on the same stream — chrome as far as
  # navigation goes (no link targets it, so clicking through the outline still
  # never rebuilds it) and a region as far as the file goes.

  Scenario: a rename reaches both panes without a reload
    When I open the home page
    And I mark this page load
    And I rename the title "Write the tests" to "Write the tests first" in the outline
    Then I see the title "Write the tests first"
    And the sidebar lists "Write the tests first"
    And the page has not reloaded

  # And the region swaps without losing what the reader did to it: the tree's
  # folds are keyed per node and re-applied after every settle, so a swap is
  # not a reason to unfold anything.

  Scenario: a sidebar fold survives the sidebar's own live re-swap
    When I open the home page
    And I fold the sidebar's "Ship the server"
    Then the sidebar's "Ship the server" is folded
    When I rename the title "Buy milk" to "Buy oat milk" in the outline
    Then I see the title "Buy oat milk"
    And the sidebar's "Ship the server" is folded

  # The update is a MORPH: what did not change in the markup is not replaced
  # in the DOM, so everything the browser hangs off those nodes — where you
  # are, what you have selected, what has focus — is still there afterwards.

  Scenario: scroll survives a live re-swap
    When I open the home page
    And the outline is long enough to scroll
    And I scroll the outline down
    And I add the title "Water the plants" to the outline
    Then I see the title "Water the plants"
    And the outline is where I scrolled it

  Scenario: a text selection survives a live re-swap
    When I open the home page
    And I select the title "Ship the server"
    And I add the title "Water the plants" to the outline
    Then I see the title "Water the plants"
    And "Ship the server" is still selected

  # The other half: a stream that stopped must not look like a quiet
  # afternoon, and a page that was away must not stay behind.
  #
  # Healthy is a state you can SEE, not the absence of the other two. An
  # indicator that shows nothing while the stream is fine reads the same as one
  # that never worked, and the whole point of this pill is to be believed.

  Scenario: the stream says it is live before anything has happened to it
    When I open the home page
    Then the page says the stream is live

  # And when the server comes back it is a NEW process. The page's stream
  # address carries the boot id of the one that drew it (live/README.md), so
  # the new server answers that address with one frame meaning reload — which
  # is how a tab open across a deploy stops sitting on markup and scripts from
  # a build that is gone. A same-code restart pays the same price; that trade
  # is the ratified one (docs/brainstorming/live-dsl.md, verdict D).

  Scenario: the stream says so when it is down, and reloads into the server that comes back
    When I open the home page
    And I mark this page load
    And the server goes away
    Then the page says it is showing last known state
    When I add the title "Water the plants" to the outline
    And the server comes back
    Then the page has reloaded
    And I see the title "Water the plants"
    And the page says the stream is live
