Feature: A plugin the vault defines
  Every other plugin in this product was compiled in: a row in `olai.yml`, a
  chunk in the bundle, a name this build has heard of. This is the other kind —
  source somebody wrote INTO the directory olai is serving, usually a node
  agent, which the serve compiles and mounts while it is running.

  A plugin like that is a FOLDER. `plugins/<word>/` holds a `README.md` saying
  what it is for a person, a required `server.ts` and an optional `browser.tsx`,
  and that is the whole of it — three plain files an agent writes through the
  ordinary write gate, a person reads in an editor, git records line by line and
  a pull request reviews. What it is not is a node with a property and two
  children carrying source in their notes, which is what it used to be and what
  nothing reads any more.

  WHAT THESE SCENARIOS ARE FOR is the last inch, and only that. Everything
  behind it is benched a directory away (`src/runtime.test.ts`,
  `src/source.test.ts`): written, pending, approved, mounted, edited, stopped,
  deleted, and every way a build can fail. What no unit test reaches is a tab
  FETCHING a chunk this serve compiled a moment ago out of a folder, and a face
  inside it DRAWING, with no reload.

  THE BOUNDARY IS A PERSON, and it is the reason the middle scenarios exist. The
  code runs with the server's own authority — there is no sandbox and this does
  not pretend to be one — so the plugin's own page draws what it does, what it
  uses and the source in full, and a person says yes in front of them. An
  approval names a VERSION, so an edit puts the plugin back to pending and
  unmounts it; and because the roster is live, an edit that lands while somebody
  has the page open DISARMS the verbs rather than swapping the source under them.

  AND CONSENT IS IN A FILE, not in a set in this process's memory: `approved`,
  `on` and `checked` are properties on a root node titled `<word>` in
  `_olai/Settings.olai`, the same file every row olai ships keeps its settings
  in. Three of these scenarios are about what that buys — a folder copied in
  arriving off and unapproved, and both halves of a decision surviving a
  restart.

  The fixture is the doc's own worked example: a `swatch` plugin whose server
  half teaches the vault the kind `hex` and whose browser half hangs a chip on
  any value wearing the composed word. The chip is located by an attribute the
  fixture's own source draws, because a vault-defined plugin's face is by
  definition not in this build's testid table.

  @scratch:plugins
  Scenario: Nobody has approved it, so nothing has been imported
    Given I open the outline "colours.olai"
    Then no row wears a swatch
    And the Plugins section lists "greeting, swatch"
    And the Plugins row "swatch" is marked "review"

    When I go to the plugin "swatch"
    Then the plugin page is about "swatch"
    And the plugin page is "review"
    And the plugin page's status says "nobody has read it yet"
    And the plugin page's README says "A colour swatch beside any hex colour."
    And the plugin page says it uses "Adds a property kind to this vault: hex"
    And the plugin page says it uses "Draws on anything wearing"
    And the plugin page's folder is "plugins/swatch/"
    And the plugin page's code tabs are "README.md, server.ts, browser.tsx"
    And the plugin page's code names "kinds.register"
    And the plugin page says what running it costs
    And the plugin page's verb is "turn-on"
    And the vault has recorded nothing about the plugin "swatch"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin with no face is a whole plugin
    Given I open the app
    When I go to the plugin "greeting"
    Then the plugin page's code tabs are "README.md, server.ts"
    And the plugin page's README says "Says hello on the server's own log"
    And there should be no page errors

  @scratch:plugins
  Scenario: Turn on, from the page, and the face draws with no reload
    Given I open the outline "colours.olai"
    And I mark the page
    When I go to the plugin "swatch"
    And I press the plugin page verb
    Then the plugin page is "on"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "yes"
    And the Plugins row "swatch" wears no mark

    When I click sidebar file "colours.olai"
    Then the row "amber" wears a swatch for "#ff8800"
    And the page has not reloaded
    And there should be no page errors
    And no member of this page has gone silent

  @scratch:plugins
  Scenario: An edit is a fresh decision, and it does not happen under the reader
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the plugin's face is edited
    Then the plugin page is "paused"
    And the plugin page's status says "changed since you turned it on"
    And the plugin page's banner says "changed"
    And no row wears a swatch
    And the plugin page's diff removes "w-3 rounded"
    And the plugin page's diff adds "w-3 rounded-full"
    And the plugin page's diff keeps "export default definePlugin({"
    And the plugin page has disarmed its verbs

    When I read the plugin "swatch" again
    Then the plugin page's verb is "turn-on-version"

    When I press the plugin page verb
    Then the plugin page is "on"
    When I click sidebar file "colours.olai"
    Then the row "amber" wears a swatch for "#ff8800"
    And that swatch is round
    And there should be no page errors

  @scratch:plugins
  Scenario: The README is not in the version, so improving the prose pauses nothing
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the plugin's README is improved
    Then the plugin page's README says "never instead of it"
    And the plugin page is "on"
    And the plugin page draws no diff
    When I open the outline "colours.olai"
    Then the row "amber" wears a swatch for "#ff8800"
    And there should be no page errors

  @scratch:plugins
  Scenario: Always trust changes, for a plugin somebody is iterating on
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    And I always trust changes to the plugin "swatch"
    Then file "_olai/Settings.olai" has namespace "swatch" setting "approved" as "always"

    When the plugin's face is edited
    Then the plugin page is "on"
    When I click sidebar file "colours.olai"
    Then the row "amber" wears a swatch for "#ff8800"
    And that swatch is round
    And there should be no page errors

  @scratch:plugins
  Scenario: The switch is a person's too, and it is in the file
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I open the plugins panel
    And I switch the plugin "swatch" off on its page
    Then the plugin page is "off"
    And the plugin page's status says "approved, switched off"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "no"
    And the Plugins row "swatch" is "off"
    And no row wears a swatch
    And there should be no page errors

  @scratch:plugins
  Scenario: The panel's switch and the page's are one fact
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I open the plugins panel
    And I switch the plugin "swatch" off
    Then file "_olai/Settings.olai" has namespace "swatch" setting "on" as "no"
    And no row wears a swatch
    When I close the plugins panel
    And I go to the plugin "swatch"
    Then the plugin page is "off"

    When I press the plugin page verb
    Then file "_olai/Settings.olai" has namespace "swatch" setting "on" as "yes"
    When I click sidebar file "colours.olai"
    Then the row "amber" wears a swatch for "#ff8800"
    And there should be no page errors

  @scratch:plugins
  Scenario: An edit to the SERVER half is a fresh decision too
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And I rewrite "plugins/swatch/server.ts" as:
      """
      import { definePlugin, Kinds } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({
        name: "swatch",
        needs: [Kinds],
        apply: Effect.gen(function*() {
          const kinds = yield* Kinds
          yield* kinds.register({
            kind: "hex",
            takes: "`swatch-hex` (a #rrggbb colour)",
            admits: (value: string) => value === "#00ff00",
          })
        }),
      })
      """
    Then the plugin page is "paused"
    And the plugin page's diff adds "value === \"#00ff00\""
    And the plugin page has disarmed its verbs

    When I read the plugin "swatch" again
    And I press the plugin page verb
    Then the plugin page is "on"
    When I open the address "/colours.olai"
    Then the outline "colours.olai" is refused for "got \"#ff8800\""
    And there should be no page errors

  @scratch:plugins
  Scenario: Only a folder directly under plugins/ is a plugin
    Given I open the app
    Then the Plugins section lists "greeting, swatch"

    When I rewrite "plugins/notes.md" as:
      """
      # Notes about my plugins

      Not a plugin.
      """
    And I rewrite "plugins/swatch/src/helper.ts" as:
      """
      export const helper = () => 1
      """
    Then the Plugins section lists "greeting, swatch"
    When I go to the plugin "swatch"
    Then the plugin page's code tabs are "README.md, server.ts, browser.tsx"
    And there should be no page errors

  @scratch:plugins
  Scenario: A folder whose name is not a word is drawn with a sentence saying so
    Given I open the app
    When I rewrite "plugins/Mixed/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "whatever", needs: [], apply: Effect.void })
      """
    And I open the plugins panel
    Then the plugins panel says "Mixed" is "is not a plugin word"

    When I close the plugins panel
    Then the Plugins row "Mixed" is marked "problem"
    And the Plugins row "Mixed" is "broken"
    And the Plugins row "Mixed" says "is not a plugin word"
    And the Plugins row "Mixed" is not a link
    And there should be no page errors

  @scratch:good
  Scenario: A folder copied in from another vault arrives off and unapproved
    Given I open the app
    Then the Plugins section lists ""

    When a plugin folder "borrowed" is copied in
    Then the sidebar has a Plugins section
    And the Plugins section lists "borrowed"
    And the Plugins row "borrowed" is marked "review"
    When I go to the plugin "borrowed"
    Then the plugin page is "review"
    And the plugin page's status says "nobody has read it yet"
    And the vault has recorded nothing about the plugin "borrowed"
    And the plugin page's verb is "turn-on"
    And there should be no page errors

  @scratch:plugins
  Scenario: Both halves of the decision survive a restart
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When the server stops
    And the server starts again on the same port
    And I open the outline "colours.olai"
    Then the row "amber" wears a swatch for "#ff8800"
    When I go to the plugin "swatch"
    Then the plugin page is "on"

    When I switch the plugin "swatch" off on its page
    And the server stops
    And the server starts again on the same port
    And I open the outline "colours.olai"
    Then no row wears a swatch
    When I go to the plugin "swatch"
    Then the plugin page is "off"
    And the plugin page's status says "approved, switched off"
    And there should be no page errors

  @scratch:plugins
  Scenario: Retracting one is deleting its folder, and the decision is left where it was
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the folder "plugins/swatch" is deleted
    Then there is no plugin called "swatch"
    And the Plugins section does not list "swatch"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "yes"
    When I open the plugins panel
    Then the plugins panel does not list "swatch"
    When I close the plugins panel
    And I click sidebar file "colours.olai"
    Then no row wears a swatch
    And there should be no page errors

  @scratch:plugins
  Scenario: Renaming the folder renames the plugin, and the old page says so
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the folder "plugins/swatch" is renamed to "plugins/swatches"
    Then there is no plugin called "swatch"
    And the Plugins section lists "greeting, swatches"
    When I go to the plugin "swatches"
    Then the plugin page is "review"
    And no row wears a swatch
    And there should be no page errors

  @scratch:plugins
  Scenario: A half deleted under an open page is a folder that is no longer a plugin
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the file "plugins/swatch/server.ts" is deleted
    Then the plugin page is "broken"
    And the plugin page says "server.ts"
    And no row wears a swatch
    And there should be no page errors

  @scratch:plugins @git:repo
  Scenario: The three files and the decision are ordinary changes in the ledger
    Given I open the outline "colours.olai"
    When a plugin folder "borrowed" is copied in
    And I open the commit panel
    Then the panel lists "plugins/borrowed/README.md" as "untracked"
    And the panel lists "plugins/borrowed/server.ts" as "untracked"

    When I press the commit pill
    And I approve the plugin "swatch"
    And I open the commit panel
    Then the commit ledger includes the "swatch" settings namespace
    And there should be no page errors
