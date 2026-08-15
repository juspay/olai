Feature: A `.html` in the vault
  A served directory is somebody's folder, and what is in one is not only
  outlines and notes: a saved article, a report a build wrote, an export from
  some other tool. olai claims `.html` the way it claims `.md` — the file is
  listed in the sidebar under the folder it lives in, with a glyph of its own,
  and it has a page at its own address that shows what the file says.

  It SHOWS it and never runs it. The markup is drawn in a frame with every
  sandbox restriction on and the strictest content policy there is in front of
  it, so a script in somebody's saved page cannot reach this app's origin and
  nothing in the file can fetch anything from anywhere. That is the promise
  worth testing, so the fixture is hostile: `report.html` tries to rewrite its
  own paragraph, write `localStorage`, set a cookie, mark the app's DOM and
  navigate the tab away. All four must fail, and the last two scenarios are
  where that is read.

  @corpus:good
  Scenario: A `.html` is listed in the sidebar and opens as a page
    When I open the app
    Then the pages listed are "report.html"
    Given I mark the page
    When I click the page "report.html"
    Then the document open is "report.html"
    And the address is "/doc/report.html"
    # A route, not a reload: the page answered in place, exactly as a document's
    # link does.
    And the page has not reloaded
    # Not "no page errors": a preview of a file WITH a script in it carries one,
    # and it is the browser saying it refused to run the thing. That refusal is
    # evidence, so it is asserted as such rather than filtered away.
    And the only complaint is the browser refusing the file's script

  @corpus:good
  Scenario: The page shows what the file says, with the file's own styling
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    # Its own `<style>` block, which is what a saved page's appearance IS — and
    # what `style-src 'unsafe-inline'` in the seal exists to allow. Refusing it
    # would leave every preview as unstyled text and nobody would use this.
    And the preview draws "Cabinet quote" in the file's own colour
    And the only complaint is the browser refusing the file's script

  @corpus:good
  Scenario: A `.html` is read, not written — there is no editor on its page
    # `write_document` takes a `.md` and refuses anything else (`@olai/ops`),
    # so an Edit control here would be a door onto a refusal. The document page
    # beside it still has one, which is what makes this an assertion about the
    # KIND rather than about the page having lost a button.
    When I open the page "report.html"
    Then there is no way to edit this page
    When I open the document "finishes.md"
    Then there is a way to edit this page

  @corpus:good
  Scenario: The frame the markup is drawn in is sealed
    # The two mechanisms, as facts on the element and in the markup rather than
    # as an outcome that could be true by luck. `sandbox=""` is EVERY
    # restriction — no scripts, and no `allow-same-origin`, so the frame's
    # origin is nobody's — and the policy in front of the markup refuses every
    # fetch there is. A reviewer attacking this reads these two lines first.
    When I open the page "report.html"
    Then the preview is sandboxed with no scripts and no same-origin
    And the preview's markup is sealed with a policy that fetches nothing

  @corpus:good
  Scenario: A script in a served `.html` cannot run, and cannot touch the app
    # The probe. `report.html`'s script would rewrite this paragraph if it ran,
    # so the paragraph is the evidence — read INSIDE the frame, where the script
    # would have run, rather than out here where nothing would have happened
    # either way.
    When I open the page "report.html"
    Then the preview says "the script did not run"
    # ...and the other three, read from the app's side: the origin the script
    # tried to write into.
    And the app's storage is untouched by the preview
    And the app's page is untouched by the preview
    And the address is "/doc/report.html"
    # The browser's own account of the same fact, from the other side: it says
    # out loud that it refused to run the script, and nothing else went wrong.
    And the only complaint is the browser refusing the file's script

  @corpus:good
  Scenario: The preview fetches nothing at all
    # The privacy half, which needs no script: a saved page full of remote
    # images would tell somebody else's server what this reader is reading, the
    # moment it is drawn. It is the same rule markdown is already held to — a
    # relative picture or nothing, and a vendored highlighter — asked of the one
    # surface that hands over foreign markup whole.
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    And the page requested nothing off this server

  @scratch:good
  Scenario: A `.html` dropped into the directory joins the sidebar
    # The same live path every other served file is on: one probe, one revision,
    # no reload. A `.html` is not a second read path.
    Given I open the app
    And I mark the page
    When I rewrite "notes/dashboard.html" as:
      """
      <h1>Dashboard</h1>
      """
    When I expand the folder "notes"
    Then the pages listed are "notes/dashboard.html, report.html"
    And the page has not reloaded
    When I click the page "notes/dashboard.html"
    Then the preview shows the heading "Dashboard"

  @corpus:good
  Scenario: A markdown link to a `.html` beside it opens the page
    # A vault links between its own files with plain relative paths, and the
    # rule that resolves one is the same arithmetic a `doc` and a picture go
    # through — beside the file the link was WRITTEN in. Before there was a page
    # to open, such a link was a full browser navigation to whatever the address
    # bar happened to resolve it against.
    Given I open the document "finishes.md"
    And I mark the page
    When I follow the link "the quote" in the rendered markdown
    Then the document open is "report.html"
    And the address is "/doc/report.html"
    And the page has not reloaded
