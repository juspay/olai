Feature: One plugin the vault defines, standing on another
  A server half can provide a service without changing core's catalog: name
  `Offers` in `needs`, yield `offers.own("colours", …)`, and olai stamps the key
  with the offering fiber's own name — `palette.colours`. A consumer mints
  `serviceTag("palette.colours")`, names it in `needs`, and gets the reactive
  half for free: it waits while nothing is behind the key, activates when
  something is, and unloads when that something leaves.

  BOTH ENDS ARE PLUGINS THIS BUILD HAS NEVER HEARD OF, which is the whole point
  of the scenario: two folders in somebody's vault, compiled this minute, wired
  to each other through a name, with nothing in core knowing the two are
  connected. The consumer's kind — `swatch-hex` — is held to whatever the
  provider's palette admits, so what the chip does on screen is the answer to
  whether the wire is live.

  AND IT IS DISCOVERY, NOT A SCHEMA REGISTRY. `vault-plugins_inspect` lists a
  key while a provider is standing behind it and stops listing it when one is
  not, which is what makes it an answer rather than a description. The shapes
  stay a contract between the two authors.

  @scratch:plugin-services
  Scenario: A plugin-owned service connects two approved folders
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    # WAITING, NOT FAILED — nothing has gone wrong. The sentence names the KEY,
    # because "waiting for something it needs" sends a person to the source and
    # a key sends them to the row that offers it.
    Then the plugins panel says "swatch" is "palette.colours"
    And no row wears a swatch
    And the agent service catalog excludes "palette.colours"

    When I approve the plugin "palette"
    Then the row "amber" wears a swatch for "#ff8800"
    And the agent service catalog includes "palette.colours"

    # ...AND THE CONSUMER'S KIND IS THE PROVIDER'S ANSWER: what the vault will
    # accept for `swatch-hex` is decided by code in another folder.
    And the vault accepts the colour "#0088ff"
    And the row "amber" wears a swatch for "#0088ff"
    And the vault accepts the colour "#ff8800"

    When I switch the plugin "palette" off
    Then the plugins panel says "swatch" is "palette.colours"
    And no row wears a swatch
    And the agent service catalog excludes "palette.colours"

    When I switch the plugin "palette" on
    Then the row "amber" wears a swatch for "#ff8800"

    When the palette provider is replaced
    # AN EDIT TO THE PROVIDER IS A FRESH DECISION ABOUT THE PROVIDER, and it
    # takes its consumer down with it: the key is withdrawn, the consumer is
    # unloaded, and the chip goes.
    Then the plugin "palette" is off without prose
    And the plugins panel says "swatch" is "palette.colours"
    And no row wears a swatch
    And the agent service catalog excludes "palette.colours"

    When I read the plugin "palette" again
    And I approve the plugin "palette"
    Then the row "amber" wears a swatch for "#ff8800"
    And the agent service catalog includes "palette.colours"
    # ...and the REPLACEMENT is what the consumer got: a palette that admits two
    # colours and refuses the one the old one allowed.
    And the vault rejects the colour "#0088ff"
    And the row "amber" wears a swatch for "#ff8800"
    And the vault accepts the colour "#00ff00"
    And the row "amber" wears a swatch for "#00ff00"
    And there should be no page errors
    And no member of this page has gone silent

  @scratch:plugins
  Scenario: With this row's own browser half unfetchable, what is already approved keeps running
    # THE FACES THIS ROW DRAWS ARE THIS ROW'S, so a tab that cannot fetch its
    # module has no Plugins section and no plugin page — and NOT a serve with no
    # plugins. The server half is another process's business: a plugin somebody
    # already turned on goes on running, its chip goes on drawing, and the
    # recovery is a retry rather than a reload.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    Given the browser module for "vault-plugins" cannot be fetched
    And I open the outline "colours.olai"
    And I mark the page
    When I open the plugins panel
    Then the plugins panel says "vault-plugins" is "Module load failed"
    And the sidebar has no Plugins section
    # ...and the approved plugin is still mounted on the server, drawing its own
    # face, which is a different row's module and a different question.
    And the row "amber" wears a swatch for "#ff8800"

    When the browser module can be fetched again
    And I retry the failed browser activation
    Then the browser activation has recovered
    And the page has not reloaded
    And the sidebar has a Plugins section

    When I close the plugins panel
    And I go to the plugin "greeting"
    And I press the plugin page verb
    Then the plugin page is "on"
    And file "_olai/Settings.olai" has namespace "greeting" setting "on" as "yes"
    And there should be no page errors
