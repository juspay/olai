Feature: fenced code is painted

  A fence names a language and the server says so on the <code> element; the
  colours are the browser's, from a highlighter this server ships itself
  (never a CDN). Nothing the racket tests can see: they stop at the markup, and
  the spans are written after it.

  The second scenario is the one that matters. A live update MORPHS the
  server's markup back over the DOM, so every painted block is plain text again
  the moment anything changes — which is why the pass runs on settle and not
  once at load.

  Scenario: a fenced block is painted on first render
    When I open the home page
    And I zoom into "Ship the server"
    Then the document on this page reads "listening"
    And the code block on this page is painted

  Scenario: it is painted again after the document is rewritten
    When I open the home page
    And I zoom into "Ship the server"
    And I mark this page load
    And I rewrite the document with a fenced block
    Then the document on this page reads "Rewritten under the server"
    And the code block on this page is painted
    And the page has not reloaded
