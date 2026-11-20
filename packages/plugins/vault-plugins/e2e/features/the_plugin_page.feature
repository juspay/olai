Feature: A plugin's own page
  `/plugins/<word>` is where a plugin the vault defines is read, decided about
  and lived with. `a_plugin_the_vault_defines.feature` is the mechanism — a
  folder reaching a fiber and a face reaching a tab. This one is the PAGE: the
  states it wears, the verbs each one offers, the settings it writes, the fault
  it hands to the conversation that caused it, and the two things it must not
  do — reload, and be redrawn because some other plugin moved.

  WHY A PAGE AT ALL, rather than a row on a panel. Because a plugin somebody
  asked for is a folder with a README, three files, a conversation that built
  it and a decision somebody has to make about code — and none of that fits
  under a disclosure triangle in a list of forty rows. The one gesture it
  exists for, reading source and saying yes to it, is the most consequential
  press in this product.

  THE SIX STATES ARE SPREAD WHERE THEY HAPPEN. *Being built* is in
  `asking_for_a_plugin.feature`, because a folder is only half-written while an
  agent is writing it; *Ready for you*, *Paused*, *On* and *Off* are in
  `a_plugin_the_vault_defines.feature`, beside the gestures that reach them.
  What is here is *Couldn't start* — which has a verb of its own and is the
  only state that hands something to somebody else.

  @scratch:good
  Scenario: Couldn't start, and the fault goes back to whoever wrote it
    Given I open the app
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "counts the hours"
    And I name the plugin "Hours"
    And I accept the name
    Then the plugin page is "building"
    And the plugin page's verb is "open-builder"

    When I rewrite "plugins/hours/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({
        name: "hours",
        needs: [],
        apply: Effect.die(new Error("the hours ran out")),
      })
      """
    Then the plugin "hours" has written "server.ts"
    When the terminal agent runs the plugin "hours"
    Then the plugin page is "review"
    And the plugin page's verb is "turn-on"

    When I press the plugin page verb
    Then the plugin page is "broken"
    And the plugin page says "the hours ran out"
    And the plugin page's verb is "ask-fix"
    And the Plugins row "hours" is marked "problem"

    When I ask the builder to fix it
    Then the builder conversation carries "will not start"
    And the builder conversation carries "the hours ran out"
    And the builder conversation carries "plugins/hours/"

    When I rewrite "plugins/hours/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "hours", needs: [], apply: Effect.void })
      """
    And I read the plugin "hours" again
    And I press the plugin page verb
    Then the plugin page is "on"
    And the plugin page offers to ask for a change
    And there should be no page errors

  @scratch:plugins
  Scenario: Settings on the page write the settings file, and an invalid one is refused where it was typed
    Given I open the app
    When I go to the plugin "greeting"
    And I press the plugin page verb
    Then the plugin page is "on"

    When I pick "red" for the plugin page setting "tone"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "tone" as "red"
    And the plugin page is "on"
    And the Plugins row "greeting" wears no mark

    When I type "77" into the plugin page setting "size"
    And I press "Enter" in the plugin page setting "size"
    Then the plugin page setting "size" is refused
    And file "_olai/Settings.olai" has namespace "greeting" setting "size" as "<absent>"
    And the plugin page is "on"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin with no knobs draws no Settings at all
    Given I open the app
    When I go to the plugin "swatch"
    Then the plugin page has no settings
    And there should be no page errors

  @scratch:plugins
  Scenario: A word with no folder behind it is a page that says so
    Given I open the plugin page for "nothing-here"
    Then there is no plugin called "nothing-here"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin rebuilt elsewhere does not disturb the page I am reading
    Given I open the app
    When I go to the plugin "swatch"
    And I press the plugin page verb
    Then the plugin page is "on"

    When I open the plugin page's "browser.tsx" tab
    And I mark the plugin page
    And I mark the page
    And I rewrite "plugins/greeting/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "greeting", needs: [], apply: Effect.void })
      """
    Then the Plugins row "greeting" is marked "review"
    And the plugin page is about "swatch"
    And the plugin page is "on"
    And the plugin page's code is "browser.tsx"
    And the plugin page is the one I marked
    And the page has not reloaded
    And there should be no page errors

  @scratch:plugins
  Scenario: The halves are addressable and deliberately not in the sidebar
    Given I open the app
    Then Reference lists the file "plugins/swatch/README.md"
    And Reference does not list the file "plugins/swatch/server.ts"
    And Reference does not list the file "plugins/swatch/browser.tsx"
    And Reference does not list the file "toolbox.ts"

    When I open the address "/plugins/swatch/server.ts"
    Then the plugin page is about "swatch"
    And the plugin page's code is "server.ts"

    When I open the address "/toolbox.ts"
    Then the empty page says "Page not found"
    And the empty page explains "olai can't open .ts files."
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: On a handset the press and its warning are in the foot
    Given I open the app
    When I go to the plugin "swatch"
    Then the plugin page is "review"
    And the plugin page's verb is in the foot
    And the plugin page's verb is "turn-on"
    And the plugin page says what running it costs

    When I press the plugin page verb
    Then the plugin page is "on"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "yes"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin can be got rid of, from the one page its files are reachable from
    Given I open the app
    When I approve the plugin "greeting"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "on" as "yes"

    When I delete the plugin "greeting" from its page
    Then the vault holds no files for the plugin "greeting"
    And the vault has recorded nothing about the plugin "greeting"
    And the Plugins section lists "swatch"
    And there should be no page errors

  @scratch:plugins
  Scenario: Always trusting changes says so afterwards, offers the way back, and moves no switch
    Given I open the app
    When I approve the plugin "greeting"
    And I go to the plugin "greeting"
    Then the plugin page is "on"
    When I switch the plugin "greeting" off on its page
    Then the plugin page is "off"

    When I always trust changes to the plugin "greeting"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "approved" as "always"
    And file "_olai/Settings.olai" has namespace "greeting" setting "on" as "no"
    And the plugin page is "off"
    And the plugin "greeting" offers to "stop" trusting changes

    When I stop trusting changes to the plugin "greeting"
    Then the plugin "greeting" offers to "start" trusting changes
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: A handset has the whole menu, so a plugin made on one can be deleted on one
    Given I open the app
    When I approve the plugin "greeting"
    And I delete the plugin "greeting" from its page
    Then the vault holds no files for the plugin "greeting"
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: On a handset the conversation opens as its own page
    Given a conversation about the plugin "greeting" called "Greeting"
    And I open the app
    When I go to the plugin "greeting"
    Then the plugin page offers to ask for a change
    When I read the unfinished plugin "greeting" anyway
    Then the plugin page's verb is in the foot
    When I ask for a change to the plugin "greeting"
    Then the conversation building "greeting" is beside the page
    And there should be no page errors
