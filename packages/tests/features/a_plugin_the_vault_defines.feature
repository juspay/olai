Feature: A plugin the vault defines
  Every other plugin in this product was compiled in: a row in `olai.yml`, a
  chunk in the bundle, a name this build has heard of. This is the other kind —
  source somebody wrote INTO the directory olai is serving, usually a node
  agent, which the serve compiles and mounts while it is running.

  A definition is a node with a `plugin` property and two children carrying the
  halves in their notes, so an agent writes one with `add_node` and `set_desc`:
  the ordinary write door, under the ordinary subtree fence, recorded by the
  ordinary ledger commit. There is no second write door and no new kind of file.

  WHAT THESE SCENARIOS ARE FOR is the last inch, and only that. Everything
  behind it is benched a package away (`@olai/server`'s `dynamic/`): written,
  pending, approved, mounted, edited, stopped, and every way a build can fail.
  What no unit test reaches is a tab FETCHING a chunk this serve compiled a
  moment ago out of a note, and a face inside it DRAWING, with no reload.

  THE BOUNDARY IS A PERSON, and it is the reason the middle scenario exists. The
  code runs with the server's own authority — there is no sandbox and this does
  not pretend to be one — so the panel draws both halves in full and a person
  says yes in front of them. An approval names a VERSION, so an edit puts the
  row back to waiting; and because the roster is live, an edit that lands while
  somebody has the block open DISARMS the verbs rather than swapping the source
  under them.

  The fixture is the doc's own worked example: a `swatch` plugin whose server
  half teaches the vault the kind `hex` and whose browser half hangs a chip on
  any value wearing the composed word. The chip is located by an attribute the
  fixture's own source draws, because a vault-defined plugin's face is by
  definition not in this build's testid table.

  @scratch:plugins
  Scenario: Nobody has approved it, so nothing has been imported
    # A DEFINITION IS A ROW AND NOT A FIBER until somebody decides. Nothing of
    # it has been compiled, imported or run — which is the state the whole
    # phase is arranged around, and the one a person is looking at when they
    # open the panel.
    Given I open the outline "colours.olai"
    Then no row wears a swatch

    When I open the plugins panel
    Then the plugins panel says "swatch" is "read the source below and approve it"
    # THE SOURCE TRAVELS, in full, which is why the roster carries it at all:
    # approving is READING, and a panel that asked somebody to say yes to a
    # content hash would be asking them to approve something they cannot see.
    And the plugins panel shows the source of "swatch"
    And the plugins panel offers to approve "swatch"

  @scratch:plugins
  Scenario: Approved, it mounts and draws without a reload
    Given I open the outline "colours.olai"
    And I open the plugins panel
    When I approve the plugin "swatch"
    # WHAT HAPPENS BETWEEN THIS LINE AND THE LAST ONE, and none of it is a
    # reload: the approval is an ordinary property write, the write publishes a
    # revision, the revision is followed, both halves are compiled, the server
    # half is mounted as a fiber on the same registry the bundle's rows are on,
    # the roster moves, the tab redials, and it fetches a chunk this serve built
    # out of a note thirty milliseconds ago.
    Then the plugins panel says nothing more about "swatch"
    # ...AND THE FACE DRAWS. The value on that row is `swatch-hex`, which is the
    # plugin's bare word composed with the plugin's own name — claimed by the
    # registration, so it is held to the kind with no declarations file in this
    # vault at all.
    And the row "amber" wears a swatch for "#ff8800"
    And there should be no page errors
    # ...AND NOTHING ELSE WENT QUIET. A plugin arriving must not take a
    # neighbour's streams down with it, which is the assertion the switch's own
    # feature made its strongest.
    And no member of this page has gone silent

  @scratch:plugins
  Scenario: An edit is a fresh decision, and it does not happen under the reader
    # THE VERSION IS A HASH OF BOTH HALVES, so an edit to either one is a
    # version nobody has approved — which is what stops "approve once" meaning
    # "approve whatever this becomes".
    Given I open the outline "colours.olai"
    And I open the plugins panel
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When the plugin's face is edited
    # BACK TO WAITING, and the fiber came down with it: the chip the approved
    # version drew is gone, because the plugin that drew it is gone.
    Then the plugins panel says "swatch" is "read the source below and approve it"
    And no row wears a swatch
    # ...AND THE VERBS ARE NOT ARMED. This is the case the serve's own guard was
    # written for and could never see: the roster is live, so the block now
    # holds source this reader has not read, and a button that stayed pressable
    # across that would approve what is there NOW rather than what was read.
    And the plugins panel says "swatch" changed while I was reading it

    When I read the plugin "swatch" again
    # READING AGAIN IS A PRESS OF ITS OWN, which is the whole of the protection:
    # a person cannot approve a version that arrived after the render they were
    # looking at without saying that they have seen it.
    Then the plugins panel offers to approve "swatch"

    When I approve the plugin "swatch"
    # ...AND WHAT MOUNTS IS THE EDITED HALF. A round chip rather than a square
    # one, so this cannot pass on the version that was already running.
    Then the row "amber" wears a swatch for "#ff8800"
    And that swatch is round
    And there should be no page errors
