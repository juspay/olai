@scratch:good
Feature: File kinds follow their claiming rows
  Claims leave and return with their rows; a browser contribution has its own lifetime.

  Scenario: The outline reader withdraws without undoing other rows' applied settings
    Given I rewrite "_olai/Inbox.olai" as:
      """
      {"id":"kind-inbox","ord":"a0","title":"captured"}
      """
    And I rewrite "_olai/Pins.olai" as:
      """
      {"id":"kind-pin","ord":"a0","title":"/house.olai"}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I open the plugins panel
    And I switch the plugin "chat" off
    Then the plugin "olai" has a session-only switch ring
    When I switch the plugin "olai" off
    Then every plugin enable switch has a session-only ring
    And the conversation is gone-from the header
    And the configured outline row refuses a mint without writing
    When I close the plugins panel
    Then no outline file is listed
    And the Inbox and Pins entries explain the configured row is off
    And the file-kind page says "No row claims `.olai`"
    When I navigate within the tab to "/_olai/Inbox.olai"
    Then the file-kind page says "No row claims `.olai`"
    When I navigate within the tab to "/_olai/Pins.olai"
    Then the file-kind page says "No row claims `.olai`"
    When I navigate within the tab to "/trash"
    Then the file-kind page says "the olai row is off"
    When I navigate within the tab to "/agenda"
    Then the file-kind page says "the olai row is off"
    When I open the plugins panel
    And I switch the plugin "olai" on
    Then the conversation is gone-from the header
    When I close the plugins panel
    And I navigate within the tab to "/house.olai"
    Then the node "handles" is shown
    And the page has not reloaded
    And there should be no page errors

  @rows-off:olai
  Scenario: A settings file cannot turn its own format reader off
    Given I open the outline "garden.olai"
    Then the node "mint" is shown
    When I open the plugins panel
    Then the plugin "olai" is running
    And the plugin "olai" has a session-only switch ring
    And the settings report the format reader's ignored durable switch
    And there should be no page errors

  Scenario: Withdrawing a PDF claim removes its files and media access
    Given I open the address "/reports/q3.pdf"
    Then the pdf drawn is "reports/q3.pdf"
    When I mark the page
    And I open the plugins panel
    And I switch the plugin "pdf" off
    And I close the plugins panel
    Then no PDF file is listed
    And media for "reports/q3.pdf" answers 404
    And the file-kind page says "No row claims `.pdf`"
    When I open the plugins panel
    And I switch the plugin "pdf" on
    And I close the plugins panel
    Then the pdf drawn is "reports/q3.pdf"
    And media for "reports/q3.pdf" answers 200
    And the page has not reloaded
    And there should be no page errors

  Scenario: A PDF page survives the Files row and its glyph returns without reload
    Given I open the address "/reports/q3.pdf"
    And I mark the page
    When I open the plugins panel
    And I switch the plugin "files" off
    And I close the plugins panel
    Then the pdf drawn is "reports/q3.pdf"
    And the directory feature "files" is absent in this tab
    When I open the plugins panel
    And I switch the plugin "files" on
    And I close the plugins panel
    Then the directory feature "files" is present in this tab
    And the PDF row has its contributed glyph
    And the page has not reloaded
    And there should be no page errors

  Scenario: Navigation withdrawal removes the tree and rail while the PDF glyph component survives
    Given the vault defines a non-UI host management controller
    And I open the address "/reports/q3.pdf"
    And I open the plugins panel
    And I approve the plugin "management-controller"
    And I close the plugins panel
    And I mark the page
    When the non-UI controller sets plugin "navigation" off
    Then the directory tree and rail are absent
    When the non-UI controller sets plugin "navigation" on
    Then the pdf drawn is "reports/q3.pdf"
    And the PDF row has its contributed glyph
    And the page has not reloaded
    And there should be no page errors

  Scenario: An unclaimed file is neither listed nor admitted by a tool
    Given I rewrite "notes.org" as:
      """
      * Not a registered format
      """
    And I open the address "/notes.org"
    Then the file-kind page says "No row claims `.org`"
    And the unclaimed file "notes.org" is absent and refused by the outline tool
    And there should be no page errors

  Scenario: Two convention files with the same stem are ambiguous
    Given I rewrite "_olai/Trash.olai" as:
      """
      {"id":"kind-trash-one","ord":"a0","title":"one"}
      """
    And I rewrite "_olai/TRASH.olai" as:
      """
      {"id":"kind-trash-two","ord":"a0","title":"two"}
      """
    And I open the outline "house.olai"
    Then the directory reports both ambiguous Trash convention files

  Scenario: Reconnecting takes fresh claims before drawing the returning tree
    Given I open the address "/reports/q3.pdf"
    And I mark the page
    When the browser goes offline
    Then the connection is "reconnecting"
    When the PDF row is disabled in the settings file
    And media for "reports/q3.pdf" answers 404
    And the browser comes back online
    Then the connection is "live"
    And no PDF file is listed
    And the file-kind page says "No row claims `.pdf`"
    When I open the plugins panel
    And I switch the plugin "pdf" on
    And I close the plugins panel
    Then the PDF row has its contributed glyph
    And the pdf drawn is "reports/q3.pdf"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A held outline with its renderer absent names the missing browser contribution
    Given I open the outline "house.olai"
    And I mark the page
    When I open the plugins panel
    And I switch the plugin "outlines" off
    And I close the plugins panel
    Then the file-kind page says "The browser page for files claimed by the olai row is unavailable."
    And the held file "house.olai" has the plain-file fallback
    When I open the plugins panel
    And I switch the plugin "outlines" on
    And I close the plugins panel
    Then the node "handles" is shown
    And the page has not reloaded
    And there should be no page errors
