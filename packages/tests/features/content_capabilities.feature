@scratch:good
Feature: Outline and Markdown capabilities have independent lifetimes
  Content state belongs to the capability that edits it. Removing another
  capability preserves the actual editor; restoring its own owner starts fresh.

  Scenario: Markdown keeps editing and saving with outlines removed
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      # Finishes

      Handles: **Markdown without outlines**.
      """
    And I mark the document editor element
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "outlines" off
    And I use the original browser tab
    Then the original document editor element is still mounted
    And the document editor holds text containing "Markdown without outlines"
    When I save the document
    Then the document renders bold text "Markdown without outlines"
    And there should be no page errors

  Scenario: An outline keeps editing and saving with Markdown removed
    Given I open the outline "house.olai"
    And I mark the screen
    When I click the title of "handles"
    And I select all and type "outline without Markdown"
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "markdown" off
    And I use the original browser tab
    Then the node "handles" was never taken away
    When I click away from the editor
    Then "house.olai" holds a node titled "outline without Markdown"
    And there should be no page errors

  Scenario: Restoring Markdown starts a fresh editor activation
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      # This draft belongs to the departed Markdown activation
      """
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "markdown" off
    And I use the original browser tab
    Then the document editor is gone
    When I use the other browser tab
    And I switch the plugin "markdown" on
    And I use the original browser tab
    Then the document open is "finishes.md"
    And the document editor is gone
    When I start editing the document
    Then the document editor holds no text containing "departed Markdown activation"
    And there should be no page errors

  Scenario: Document property navigation retracts with Markdown while the outline survives
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"brief":"finishes.md"}}
      """
    And I open the outline "house.olai"
    Then the property "brief" on "handles" is a "document" door to "/finishes.md"
    When I open the plugins panel
    And I switch the plugin "markdown" off
    And I close the plugins panel
    Then the node "handles" is shown
    And the property "brief" on "handles" is not a link
    When I open the plugins panel
    And I switch the plugin "markdown" on
    And I close the plugins panel
    Then the property "brief" on "handles" is a "document" door to "/finishes.md"
    And there should be no page errors

  Scenario: A missing Markdown document retains its conflict baseline with outlines disabled
    Given I rewrite "notes/palette.md" as:
      """
      **original independent document**
      """
    And I open the document "notes/palette.md"
    When I open the plugins panel
    And I switch the plugin "outlines" off
    And I close the plugins panel
    And I start editing the document
    And I retype the document as:
      """
      **independent retained draft**
      """
    And I remove the served file "notes/palette.md"
    Then the main pane says there is no document "notes/palette.md"
    When I rewrite "notes/palette.md" as:
      """
      **original independent document**
      """
    Then the document editor holds text containing "independent retained draft"
    When I save the document
    Then the document renders bold text "independent retained draft"
    And there should be no page errors

  Scenario: Markdown frontmatter remains readable and tracks edits with outlines disabled
    Given I open the document "notes/palette.md"
    Then the document shows the property "agent" holding "claude-opus"
    When I open the plugins panel
    And I switch the plugin "outlines" off
    And I close the plugins panel
    Then the document shows the property "agent" holding "claude-opus"
    When I start editing the document
    Then the document shows no properties
    When I retype the document as:
      """
      ---
      agent: independent-markdown
      tags: [one, two]
      ---
      **updated independently**
      """
    And I save the document
    Then the document shows the property "agent" holding "independent-markdown"
    And the document shows the property "tags" holding "one, two"
    And the document renders bold text "updated independently"
    And there should be no page errors

  # THE FILE TREE IS THE VAULT'S, NOT THE PAGE PROVIDER'S. `heads` is every
  # served file and `documents` is a SUBSET OF ITS KEYS, so Markdown leaving
  # takes a document's PAGE and not its ROW: the `.md` is still in the
  # directory, and the sidebar goes on drawing it beside the outlines.
  #
  # That containment was one collection's business until phase 18 and is now a
  # claim across three rows (`olai-plugin-vault`'s `heads`,
  # `olai-plugin-outlines`, `olai-plugin-markdown`). `@olai/bundle`'s
  # `published.test.ts` asserts it for ONE revision of a whole roster; nothing
  # asserted it for a roster a row actually LEFT. The browser failure this
  # catches is a tree built from the departed row's keys rather than the
  # vault's — the document vanishes from the sidebar the moment its page
  # provider is switched off, and a reader loses the file rather than the page.
  #
  # Why the existing cases do not catch it: `the_vault_is_a_row.feature` flips
  # the OWNER of `heads` off and on twice and never looks at the tree, and
  # `file_delete_concurrency.feature` has both halves in different scenarios.
  Scenario: A document keeps its row in the file tree when Markdown leaves
    Given I open the outline "house.olai"
    And I mark the page
    Then the outline list links to "house.olai"
    And the document link "finishes.md" is shown
    When I open the plugins panel
    And I switch the plugin "markdown" off
    And I close the plugins panel
    # The file did not leave the directory; only its page did.
    Then the outline list links to "house.olai"
    And the document link "finishes.md" is shown
    # ...and the surviving rows are still being SERVED. A tree drawn off a
    # roster frame draws whether or not the members under it are alive.
    And no member of this page has gone silent
    When I open the plugins panel
    And I switch the plugin "markdown" on
    And I close the plugins panel
    Then the document link "finishes.md" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: Restoring outlines does not revive an unsubmitted draft from its departed activation
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type ""
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "outlines" off
    And I use the original browser tab
    Then the outline content has no row editor
    When I use the other browser tab
    And I switch the plugin "outlines" on
    And I use the original browser tab
    Then the node "handles" is shown
    When I click the title of "handles"
    Then the row being typed holds "choose the handles"
    And there should be no page errors

  @plugins:vault,ws,web-app,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,markdown,files
  Scenario: A Markdown-only startup edits a document without ever activating outlines
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      ---
      topic: independent startup
      ---
      **Markdown was the only content provider**
      """
    And I save the document
    Then the document renders bold text "Markdown was the only content provider"
    And the document shows the property "topic" holding "independent startup"
    And there should be no page errors

  @plugins:vault,ws,web-app,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,files
  Scenario: An outline-only startup edits rows without ever activating Markdown
    Given I open the outline "house.olai"
    When I click the title of "handles"
    And I select all and type "only outlines at startup"
    And I press "Enter"
    And I press "Escape"
    Then "house.olai" holds a node titled "only outlines at startup"
    When I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And there should be no page errors
