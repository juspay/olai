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
  `on` and `builder` are properties on a root node titled `<word>` in
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
    # A FOLDER IS A ROW AND NOT A FIBER until somebody decides. Nothing of it
    # has been compiled, imported or run — which is the state the whole phase is
    # arranged around, and the one a person is looking at when they open the
    # page.
    Given I open the outline "colours.olai"
    Then no row wears a swatch
    And the Plugins section lists "greeting, swatch"
    And the Plugins row "swatch" is marked "review"

    When I go to the plugin "swatch"
    Then the plugin page is about "swatch"
    And the plugin page is "review"
    And the plugin page's status says "nobody has read it yet"
    # WORDS BEFORE CODE: the README's own heading and sentence, then what the
    # code reaches for — read off its own imports rather than off anything the
    # author wrote in prose.
    And the plugin page's README says "A colour swatch beside any hex colour."
    And the plugin page says it uses "Adds a property kind to this vault: hex"
    And the plugin page says it uses "Draws on anything wearing"
    # ...AND THEN THE SOURCE, in full, one tab per file, with the folder named
    # over it. Approving is READING, and a page that asked somebody to say yes
    # to a content hash would be asking them to approve something they cannot
    # see.
    And the plugin page's folder is "plugins/swatch/"
    And the plugin page's code tabs are "server.ts, browser.tsx"
    And the plugin page's code names "kinds.register"
    And the plugin page says what running it costs
    And the plugin page's verb is "turn-on"
    # ...AND THE VAULT HAS SAID NOTHING ABOUT IT. The folder is on disk and the
    # consent is not, which is the whole of why a copied folder is safe.
    And the vault has recorded nothing about the plugin "swatch"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin with no face is a whole plugin
    # `browser.tsx` is optional, and the ABSENCE is asserted beside the presence
    # because a page that quietly drew an empty second tab would be inventing a
    # file the author did not write, in the one place a person is being asked to
    # say yes to what they can see.
    Given I open the app
    When I go to the plugin "greeting"
    Then the plugin page's code tabs are "server.ts"
    And the plugin page's README says "Says hello on the server's own log"
    And there should be no page errors

  @scratch:plugins
  Scenario: Turn on, from the page, and the face draws with no reload
    Given I open the outline "colours.olai"
    And I mark the page
    When I go to the plugin "swatch"
    And I press the plugin page verb
    # ONE PRESS, TWO PROPERTIES, ONE WRITE. They were one gesture when the
    # switch was a set in this process's memory and the approval was the only
    # durable thing about a plugin; they are both durable now and they land
    # together, so a press cannot leave half of itself behind.
    Then the plugin page is "on"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "yes"
    And the Plugins row "swatch" wears no mark

    When I click sidebar file "colours.olai"
    # WHAT HAPPENED BETWEEN THE PRESS AND THIS LINE, and none of it is a reload:
    # the approval is an ordinary property write, the write publishes a revision,
    # the revision is followed, both halves are compiled, the server half is
    # mounted as a fiber on the same registry the bundle's rows are on, the
    # roster moves, the tab redials, and it fetches a chunk this serve built out
    # of a folder thirty milliseconds ago.
    #
    # ...AND THE FACE DRAWS. The value on that row is `swatch-hex`, which is the
    # plugin's bare word composed with the plugin's own name — claimed by the
    # registration, so it is held to the kind with no declarations file in this
    # vault at all.
    Then the row "amber" wears a swatch for "#ff8800"
    And the page has not reloaded
    And there should be no page errors
    # ...AND NOTHING ELSE WENT QUIET. A plugin arriving must not take a
    # neighbour's streams down with it, which is the assertion the switch's own
    # feature made its strongest.
    And no member of this page has gone silent

  @scratch:plugins
  Scenario: An edit is a fresh decision, and it does not happen under the reader
    # THE VERSION IS A HASH OF BOTH HALVES, so an edit to either one is a version
    # nobody has approved — which is what stops "approve once" meaning "approve
    # whatever this becomes".
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the plugin's face is edited
    # PAUSED, not merely pending: the person's switch is still up and what was
    # running stopped. The chip the approved version drew is gone, because the
    # plugin that drew it is gone.
    Then the plugin page is "paused"
    And the plugin page's status says "changed since you turned it on"
    And the plugin page's banner says "changed"
    And no row wears a swatch
    # WHAT CHANGED, rather than the whole file again. The person already read
    # this plugin and has been running it; what moved is one class name, and
    # that is the whole of the new decision. A page that re-presented eighty
    # lines would be asking a question whose answer it has already been given.
    And the plugin page's diff removes "w-3 rounded"
    And the plugin page's diff adds "w-3 rounded-full"
    And the plugin page's diff keeps "export default definePlugin({"
    # ...AND THE VERBS ARE NOT ARMED. This is the case the serve's own guard was
    # written for and could never see: the roster is live, so the page now holds
    # source this reader has not read, and a button that stayed pressable across
    # that would approve what is there NOW rather than what was read.
    And the plugin page has disarmed its verbs

    When I read the plugin "swatch" again
    # READING AGAIN IS A PRESS OF ITS OWN, which is the whole of the protection:
    # a person cannot approve a version that arrived after the render they were
    # looking at without saying that they have seen it.
    Then the plugin page's verb is "turn-on-version"

    When I press the plugin page verb
    Then the plugin page is "on"
    When I click sidebar file "colours.olai"
    # ...AND WHAT MOUNTS IS THE EDITED HALF. A round chip rather than a square
    # one, so this cannot pass on the version that was already running.
    Then the row "amber" wears a swatch for "#ff8800"
    And that swatch is round
    And there should be no page errors

  @scratch:plugins
  Scenario: The README is not in the version, so improving the prose pauses nothing
    # A plugin that paused itself every time its description improved would
    # teach people to press Turn on without looking, which is the one habit
    # this whole lane exists to prevent.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the plugin's README is improved
    Then the plugin page's README says "never instead of it"
    And the plugin page is "on"
    And the plugin page draws no diff
    And the row "amber" wears a swatch for "#ff8800"
    And there should be no page errors

  @scratch:plugins
  Scenario: Always trust changes, for a plugin somebody is iterating on
    # The escape hatch, under `•••`, and the argument for it is honest: a person
    # re-approving every edit an agent makes stops reading after the third time,
    # and a decision nobody reads is worse than one they made on purpose once.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    And I always trust changes to the plugin "swatch"
    Then file "_olai/Settings.olai" has namespace "swatch" setting "approved" as "always"

    When the plugin's face is edited
    # NO SECOND DECISION: the edited half mounts itself, which is what `always`
    # means and the only thing it means.
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

    When I switch the plugin "swatch" off on its page
    # OFF, BUT STILL APPROVED — two facts, kept apart, because somebody who
    # read this code once should not have to read it again to turn it back on.
    Then the plugin page is "off"
    And the plugin page's status says "approved, switched off"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "no"
    And the Plugins row "swatch" is "off"
    And no row wears a swatch
    And there should be no page errors

  @scratch:plugins
  Scenario: The panel's switch and the page's are one fact
    # The plugins panel still lists every row this serve has, and a vault
    # plugin's switch there is CORE's switch — the same property, in the same
    # file, read by the same reader. Two faces onto one fact is fine; two facts
    # would not be, and this is the scenario that says which it is.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I switch the plugin "swatch" off
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
    # The version is a hash of BOTH halves. A page that only noticed the face
    # moving would let an agent rewrite everything that actually runs under an
    # approval somebody gave to something else.
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
    And no row wears a swatch

    When I read the plugin "swatch" again
    And I press the plugin page verb
    Then the plugin page is "on"
    # ...and what is in force is the edited half: the vault's own colour is no
    # longer one this plugin admits.
    And the vault rejects the colour "#ff8800"
    And the vault accepts the colour "#00ff00"
    And there should be no page errors

  @scratch:plugins
  Scenario: Only a folder directly under plugins/ is a plugin
    # `plugins/notes.md` is somebody's note about their plugins and
    # `plugins/swatch/src/helper.ts` is a file an agent left in a folder. The
    # folder IS the plugin, so neither is one — and neither is swept into the
    # one that is.
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
    Then the plugin page's code tabs are "server.ts, browser.tsx"
    And there should be no page errors

  @scratch:plugins
  Scenario: A folder whose name is not a word is drawn with a sentence saying so
    # The folder's name IS the word — the row's id, the settings namespace, the
    # slot key and the address — so a name that is not one is a fact about the
    # FOLDER, and the sentence is core's own rather than the author's: what is
    # wrong is the shape of the thing rather than the code in it. (The other
    # fault of this kind, a word this build already ships, is refused before a
    # folder exists — `asking_for_a_plugin.feature`.)
    Given I open the app
    When I rewrite "plugins/Mixed/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "whatever", needs: [], apply: Effect.void })
      """
    And I open the plugins panel
    Then the plugins panel says "Mixed" is "is not a plugin word"
    And there should be no page errors

  @scratch:good
  Scenario: A folder copied in from another vault arrives off and unapproved
    # THE CODE TRAVELS AND THE CONSENT DOES NOT, which is the whole argument for
    # keeping `approved` and `on` in the settings file rather than in the folder.
    # A plugin that carried its own yes would be a plugin that approved itself by
    # being copied, and copying is exactly how a plugin is meant to travel.
    Given I open the app
    Then the sidebar has no Plugins section

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
    # ENABLEMENT USED TO BE A SET IN THIS PROCESS'S MEMORY, so a plugin somebody
    # turned off came back on at the next boot and an approval was the only
    # durable thing about a plugin. Both are in a file now, and this is the
    # scenario that says so in the only way that counts: by killing the server.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When the server stops
    And the server starts again on the same port
    And I open the outline "colours.olai"
    # NO SECOND APPROVAL AND NO SECOND PRESS: the fiber was mounted out of what
    # the settings file already said.
    Then the row "amber" wears a swatch for "#ff8800"
    When I go to the plugin "swatch"
    Then the plugin page is "on"

    When I switch the plugin "swatch" off on its page
    And the server stops
    And the server starts again on the same port
    And I open the outline "colours.olai"
    # ...AND SO DOES THE STOP, which is the half the old shape got wrong: `on:
    # no` is in a file, so a restart comes back to it rather than past it.
    Then no row wears a swatch
    When I go to the plugin "swatch"
    Then the plugin page is "off"
    And the plugin page's status says "approved, switched off"
    And there should be no page errors

  @scratch:plugins
  Scenario: Retracting one is deleting its folder, and the decision is left where it was
    # There is no second gesture and no tombstone: the row goes on the next
    # revision and the fiber unwinds every registration it made. The settings
    # node is LEFT, which is the honest behaviour — a folder that comes back
    # comes back to the decision somebody already made about it.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the folder "plugins/swatch" is deleted
    Then there is no plugin called "swatch"
    And the Plugins section does not list "swatch"
    And file "_olai/Settings.olai" has namespace "swatch" setting "approved" as "<absent>"
    When I open the plugins panel
    Then the plugins panel does not list "swatch"
    When I close the plugins panel
    And I click sidebar file "colours.olai"
    Then no row wears a swatch
    And there should be no page errors

  @scratch:plugins
  Scenario: Renaming the folder renames the plugin, and the old page says so
    # THE FOLDER'S NAME IS THE WORD — the row's id, the settings namespace, the
    # slot key and the address — so a rename is a different plugin arriving and
    # the old one leaving, and the page somebody had open says that rather than
    # quietly following the rename to a plugin they never read.
    Given I open the outline "colours.olai"
    When I approve the plugin "swatch"
    Then the row "amber" wears a swatch for "#ff8800"

    When I go to the plugin "swatch"
    And the folder "plugins/swatch" is renamed to "plugins/swatches"
    Then there is no plugin called "swatch"
    And the Plugins section lists "greeting, swatches"
    # ...and the new word is a plugin nobody has approved, because the approval
    # named the old one.
    When I go to the plugin "swatches"
    Then the plugin page is "review"
    And no row wears a swatch
    And there should be no page errors

  @scratch:plugins
  Scenario: A half deleted under an open page is a folder that is no longer a plugin
    # `server.ts` is the one file a plugin cannot be without. Taking it away is
    # what a person's own delete through the file controls does, and what a
    # half-finished folder looks like from the outside — so the page says what
    # is wrong rather than drawing a plugin that cannot exist.
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
    # WHAT THAT BUYS IS NOT TIDINESS. A plugin is a thing you can show somebody:
    # a folder, with a README at the top of it, that travels by being copied,
    # that git records line by line, and that a pull request can review. The
    # commit panel listing the halves BY PATH is that claim, said where a person
    # meets it.
    Given I open the outline "colours.olai"
    When I open the commit panel
    Then the panel lists "plugins/swatch/README.md" as "untracked"
    And the panel lists "plugins/swatch/server.ts" as "untracked"
    And the panel lists "plugins/swatch/browser.tsx" as "untracked"

    When I press the commit pill
    And I approve the plugin "swatch"
    And I open the commit panel
    # ...AND SO IS THE YES. An approval is an ordinary property write through the
    # ordinary gate, so it is in the ledger beside the code it is about.
    Then the commit ledger includes the "swatch" settings namespace
    And there should be no page errors
