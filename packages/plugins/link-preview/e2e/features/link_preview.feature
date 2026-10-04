@scratch:good @share-scratch
Feature: Live read-only internal link previews
  Background:
    Given the link preview examples are served
    And I open the node "preview-source"

  Scenario: A note link previews context, facts, note and a clipped child list
    When I hover the preview link "target"
    Then the link preview contains "Preview target #sample"
    And the link preview contains "Preview parent"
    And the link preview contains "A live note"
    And the link preview contains "Child one"
    And the link preview contains "+1 more"
    And the link preview contains "2026-10-04"
    And the link preview is read-only and clipped
    And there should be no page errors

  Scenario: Moving into the card keeps it open, leaving closes it
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I move onto the preview card
    Then the link preview remains open
    When I leave the preview card
    Then the link preview closes

  Scenario: Escape dismisses until the next deliberate hover
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I dismiss the link preview with Escape
    Then the link preview closes
    When I hover the preview link "dead"
    Then the link preview contains "Nothing at #preview-missing"

  Scenario: Keyboard focus opens and blur closes
    When I focus the preview link "target"
    Then the link preview contains "Preview target"
    When I blur the preview link
    Then the link preview closes

  @wire
  Scenario: Short hovers do not subscribe and leaving cancels opening
    Given I mark the wire
    When I briefly hover the preview link "target"
    Then the link preview stays closed
    And no preview target page was requested

  Scenario: Only one preview survives rapid changes of target
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I hover the preview link "dead"
    Then the link preview contains "Nothing at #preview-missing"
    And there is exactly one link preview

  @wire
  Scenario: Qualified row and outline file previews
    Given I mark the wire
    When I hover the preview link "row"
    Then the link preview contains "Preview target"
    And the qualified preview requested only the target node
    When I hover the preview link "wrong row"
    Then the link preview contains "Nothing at house.olai#preview-target"
    When I hover the preview link "outline"
    Then the link preview contains "Preview parent"
    And the link preview contains "+1 more"

  Scenario: Documents and sections use the document's actual heading ids
    When I hover the preview link "document"
    Then the link preview contains "Opening paragraph"
    And the preview document marks its missing link dead
    When I hover the preview link "heading"
    Then the link preview contains "Second section text"
    And the link preview does not contain "Opening paragraph"
    And the link preview does not contain "Third section text"
    When I hover the preview link "missing heading"
    Then the link preview contains "Nothing at preview.md#absent"

  Scenario: Local fragments and external links do not preview
    When I hover the preview link "local"
    Then the link preview stays closed
    When I hover the preview link "external"
    Then the link preview stays closed

  Scenario: A link arriving under a stationary pointer waits for deliberate movement
    Given the link preview examples are served
    And I open the node "preview-source"
    When I hover the preview link "local"
    And a target link replaces the local link under the stationary pointer
    Then the link preview stays closed
    When I move slightly within the preview link "local"
    Then the link preview contains "Preview target"

  Scenario: Links inside active editors do not preview
    When I make the preview note an active editor
    And I hover the preview link "target"
    Then the link preview stays closed

  Scenario: A live preview patches its title without replacing the card
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I mark the preview card identity
    And I change the preview target on disk
    Then the link preview contains "Changed preview target"
    And the preview card identity is unchanged
    When I delete the preview target on disk
    Then the link preview contains "Nothing at #preview-target"

  @wire
  Scenario: A preview stops reading when closed and reads fresh when reopened
    Given I mark the wire
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I leave the preview card
    Then the link preview closes
    And the preview target page subscription is closed
    When I change the preview target on disk
    And I hover the preview link "target"
    Then the link preview contains "Changed preview target"

  Scenario: A link inside the card navigates without nesting
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I hover the nested preview link
    Then there is exactly one link preview
    And the link preview contains "Preview target"
    When I click the nested preview link
    Then the address is "/#preview-destination"
    And there should be no page errors

  Scenario: Hover leaves normal and split navigation intact
    Given I mark the page
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I alt-click the preview link "target"
    Then there are 2 panes
    And pane 1 is showing "/#preview-target"
    And the page has not reloaded

  Scenario: Plain click still opens the link
    Given I mark the page
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I click the preview link "target"
    Then the address is "/#preview-target"
    And the page has not reloaded

  Scenario: Removing the preview plugin clears its card and listeners
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I set the preview plugin "link-preview" off on disk
    Then the link preview closes
    And the preview overlay is removed
    When I hover the preview link "target"
    Then the link preview stays closed
    When I set the preview plugin "link-preview" on on disk
    And I leave the preview card
    And I hover the preview link "target"
    Then the link preview contains "Preview target"
    And there is exactly one link preview

  Scenario: Withdrawing a content renderer removes its open card
    When I hover the preview link "document"
    Then the link preview contains "Opening paragraph"
    When I set the preview plugin "markdown" off on disk
    Then the link preview closes
    When I set the preview plugin "markdown" on on disk
    And I leave the preview card
    And I hover the preview link "document"
    Then the link preview contains "Opening paragraph"

  @phone
  Scenario: Touch and coarse-device focus do not preview
    When I touch the preview link "target"
    Then the link preview stays closed
    When I focus the preview link "target"
    Then the link preview stays closed

  Scenario: See links and backlinks use the same preview renderer
    When I hover the preview see link
    Then the link preview contains "Preview target"
    When I open the node "preview-target"
    And I expand the preview backlinks
    And I hover the preview backlink
    Then the link preview contains "Preview source"
    And there should be no page errors

  Scenario: Removing a hovered anchor closes its reading
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I remove the preview source links on disk
    Then the link preview closes

  Scenario: Links under a real row editor do not preview
    Given I open the outline "preview.olai"
    When I open the note of "preview-source"
    And I click the title of "preview-source"
    And I hover the editing row permalink
    Then the link preview stays closed

  Scenario: A nested link belongs to the hovered pane even if its neighbour is focused
    When I alt-click the preview link "target"
    Then pane 1 is focused
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I click the nested preview link
    Then pane 0 is showing "/#preview-destination"
    And pane 1 is showing "/#preview-target"

  Scenario: A focused link can hand the pointer to the card without blur dismissing it
    When I focus the preview link "target"
    Then the link preview contains "Preview target"
    When I move onto the preview card
    Then the link preview is read-only and clipped
    And the link preview remains open
    When I dismiss the link preview with Escape
    Then the link preview closes

  Scenario: Escape belongs only to the open preview
    When I focus the preview link "target"
    Then the link preview contains "Preview target"
    When I watch Escape beneath the preview
    And I dismiss the link preview with Escape
    Then the link preview closes
    And Escape leaves the preview's underlying page untouched
    And the address is "/#preview-source"
    And Escape reaches the page when no preview is open

  Scenario: Removing a visible child keeps the live card intact
    When I hover the preview link "target"
    Then the link preview contains "Child one"
    When I mark the preview card identity
    And I remove the first preview child on disk
    Then the link preview contains "Child four"
    And the link preview does not contain "Child one"
    And the preview card identity is unchanged
    And there should be no page errors

  @phone
  Scenario: A mouse on a touch-primary device can preview
    When I hover the preview link "target"
    Then the link preview contains "Preview target"

  Scenario: The preview owns only its accessible description token
    When the preview source has an existing description
    And I focus the preview link "target"
    Then the link preview contains "Preview target"
    And the preview describes its source link
    When I dismiss the link preview with Escape
    Then the link preview closes
    And closing the preview preserves the original description

  Scenario: Replacing an anchor transfers only the card's description token
    When the preview source has an existing description
    And I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I mark the preview card identity
    And the open preview anchor is replaced in place
    Then the link preview remains open
    And the preview card identity is unchanged
    And the preview describes its source link
    And the removed anchor has only its original description
    When I set the preview plugin "link-preview" off on disk
    Then the link preview closes
    And closing the preview preserves the original description

  Scenario: Plugin withdrawal removes an otherwise absent description attribute
    When I hover the preview link "target"
    Then the link preview contains "Preview target"
    When I set the preview plugin "link-preview" off on disk
    Then the link preview closes
    And the preview source has no description token
