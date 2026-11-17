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
    # THE WHOLE LOOP, in one scenario: a person asks for a plugin, an agent
    # writes a half that throws, the person turns it on, it does not start, and
    # one press hands the fault VERBATIM to the conversation that produced it.
    # An agent told "it broke" has to go and find out what, and the serve
    # already knows.
    Given I open the app
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "counts the hours"
    And I name the plugin "Hours"
    And I accept the name
    Then the plugin page is "building"
    # THE VERB WHILE IT IS BEING WRITTEN is a way INTO the conversation, not a
    # Stop: stopping used to write `on: no` on a plugin nobody had approved —
    # which stops nothing, since an unapproved plugin was never going to start
    # — while the agent went on writing. What actually stops a build is the
    # agent's own Stop, inside the conversation.
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
    # ...AND THE AGENT SAYS IT IS DONE, which is what ends *being built*: the
    # files landing cannot mean it, because the guide has the builder write the
    # face last and a page that called the folder finished at `server.ts` rang
    # *Ready for you* at a plugin still being written.
    Then the plugin "hours" has written "server.ts"
    When the terminal agent runs the plugin "hours"
    # THE FOLDER IS WHOLE AND ITS AUTHOR IS FINISHED, so it is a thing a person
    # may decide about, even though deciding will not go well.
    Then the plugin page is "review"
    And the plugin page's verb is "turn-on"

    When I press the plugin page verb
    # FAILED IS A STATE WITH A SENTENCE, not an error: what is wrong is the
    # plugin's own `apply`, so what the page says is the plugin's own words.
    Then the plugin page is "broken"
    And the plugin page says "the hours ran out"
    And the plugin page's verb is "ask-fix"
    And the Plugins row "hours" is marked "problem"

    When I ask the builder to fix it
    Then the builder conversation carries "will not start"
    And the builder conversation carries "the hours ran out"
    And the builder conversation carries "plugins/hours/"

    # ...AND THE LOOP CLOSES. The agent writes the half again, which is an edit
    # and therefore a fresh decision: the person reads what moved and says yes
    # to it, and the plugin that would not start is running.
    When I rewrite "plugins/hours/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect } from "effect"

      export default definePlugin({ name: "hours", needs: [], apply: Effect.void })
      """
    And I read the plugin "hours" again
    And I press the plugin page verb
    Then the plugin page is "on"
    # ...and NOW there is somewhere to send a change, so the page offers it.
    And the plugin page offers to ask for a change
    And there should be no page errors

  @scratch:plugins
  Scenario: Settings on the page write the settings file, and an invalid one is refused where it was typed
    # A KNOB IS NOT CODE. The version is a hash of the two halves, so moving a
    # setting re-applies the row without touching its approval — which is what
    # makes a knob a thing an owner can move without reading the source again.
    Given I open the app
    When I go to the plugin "greeting"
    And I press the plugin page verb
    Then the plugin page is "on"

    When I pick "red" for the plugin page setting "tone"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "tone" as "red"
    # ...AND IT IS STILL ON, which is the half that would be silently wrong if
    # a configuration write went through the approval path.
    And the plugin page is "on"
    And the Plugins row "greeting" wears no mark

    When I type "77" into the plugin page setting "size"
    And I press "Enter" in the plugin page setting "size"
    # REFUSED IN PLACE: the schema is the plugin's own, the serve is what judges
    # it, and the reason lands under the control a person typed into rather than
    # in a toast somewhere else.
    Then the plugin page setting "size" is refused
    And file "_olai/Settings.olai" has namespace "greeting" setting "size" as "<absent>"
    And the plugin page is "on"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin with no knobs draws no Settings at all
    # Nothing is drawn where there is nothing to say: an empty *Settings*
    # heading would be a control that does nothing, on the one page where every
    # control means something.
    Given I open the app
    When I go to the plugin "swatch"
    Then the plugin page has no settings
    And there should be no page errors

  @scratch:plugins
  Scenario: A word with no folder behind it is a page that says so
    # The address PARSES — it is a plugin somebody deleted, or a link from
    # another vault — and the page's own arm is the honest answer to it rather
    # than a route that falls through to a general not-found.
    Given I open the plugin page for "nothing-here"
    Then there is no plugin called "nothing-here"
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin rebuilt elsewhere does not disturb the page I am reading
    # A ROSTER IS PUBLISHED TO EVERY TAB, and a page keyed carelessly would be
    # torn down and built again every time any plugin anywhere moved — losing
    # the tab somebody had open, the place they were reading, and the version
    # the verbs were armed against.
    Given I open the app
    When I go to the plugin "swatch"
    And I press the plugin page verb
    Then the plugin page is "on"

    When I open the plugin page's "browser.tsx" tab
    # TWO MARKS, because the claim is two: the page's own element survived (so
    # nothing re-keyed it) and the DOCUMENT survived (so nothing navigated).
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
    # TWO FRONT DOORS ONTO ONE FILE is how a sidebar fills up with the app's own
    # plumbing. The halves are in the set, in the ledger and at an address — and
    # the plugin's own page is where they are READ, with the file names over them
    # and a diff when they change. The README is the other half of the claim: an
    # ordinary document, markdown's own, listed like any other `.md`.
    Given I open the app
    Then Reference lists the file "plugins/swatch/README.md"
    And Reference does not list the file "plugins/swatch/server.ts"
    And Reference does not list the file "plugins/swatch/browser.tsx"
    # ...AND A `.ts` THAT IS NOT A PLUGIN'S IS NOT SERVED AT ALL. The claim is
    # scoped to `plugins/`, so a checkout somebody keeps beside their notes is
    # none of olai's business: no row, no address, nothing compiled.
    And Reference does not list the file "toolbox.ts"

    # ...AND A HALF'S OWN PATH IS AN ADDRESS THAT OPENS THE PLUGIN'S PAGE at
    # that half. A file with no page of its own used to leave the pane drawing
    # whatever it had been drawing, which is the one answer worse than a
    # refusal — and the plugin's page is where a half is read on purpose.
    When I open the address "/plugins/swatch/server.ts"
    Then the plugin page is about "swatch"
    And the plugin page's code is "server.ts"

    When I open the address "/toolbox.ts"
    Then the empty page says "Page not found"
    And the empty page explains "olai can't open .ts files."
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: On a handset the press and its warning are in the foot
    # The one press this page exists for may not be the thing a person has to
    # scroll to find — and the sentence about what running a plugin costs
    # belongs beside the press rather than a screen above it.
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
    # THE HALVES ARE NOT IN THE SIDEBAR'S FILE TREE, by design — so nothing
    # else in the app can delete them, and without this verb a plugin somebody
    # made in one sentence needs a terminal to be rid of.
    Given I open the app
    When I approve the plugin "greeting"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "on" as "yes"

    When I delete the plugin "greeting" from its page
    Then the vault holds no files for the plugin "greeting"
    # ...AND THE DECISION GOES WITH IT, which is the one difference from a
    # folder taken away by hand: that leaves the node where it was made, and
    # this is a person ending the plugin.
    And the vault has recorded nothing about the plugin "greeting"
    And the Plugins section lists "swatch"
    And there should be no page errors

  @scratch:plugins
  Scenario: Always trusting changes says so afterwards, offers the way back, and moves no switch
    # The menu item is about READING — every later version may run without
    # being read again — and it used to be spelled as an approval with
    # `forever`, so choosing it on a plugin somebody had switched off turned it
    # back on: a second decision, made silently, out of a menu that never
    # mentioned it.
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
    # ...and the menu says which way the decision is pointing, with the press
    # the other way, rather than leaving no sign and no way out.
    And the plugin "greeting" offers to "stop" trusting changes

    When I stop trusting changes to the plugin "greeting"
    Then the plugin "greeting" offers to "start" trusting changes
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: A handset has the whole menu, so a plugin made on one can be deleted on one
    # The `•••` was drawn beside the head's verb only, and the head is hidden
    # below `md` — so *Always trust changes* and *Delete…* were unreachable on
    # the one device where this page is most of what a person sees.
    Given I open the app
    When I approve the plugin "greeting"
    And I delete the plugin "greeting" from its page
    Then the vault holds no files for the plugin "greeting"
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: On a handset the conversation opens as its own page
    # A phone has no room for two panes side by side, so *Ask for a change…*
    # opens the builder chat as its own page in the strip beside this one. The
    # sentence this used to draw — "no agent is available to ask right now" —
    # was false: the agent is there, it was the column that was not.
    Given a conversation about the plugin "greeting" called "Greeting"
    And I open the app
    When I go to the plugin "greeting"
    Then the plugin page offers to ask for a change
    # ...and no primary verb at all while the folder is still being written:
    # the only thing that stops a build is the agent's own Stop inside the
    # conversation.
    And the plugin page offers no verb
    When I read the unfinished plugin "greeting" anyway
    Then the plugin page's verb is in the foot
    # ...and the press opens the builder chat as a page of its own.
    When I ask for a change to the plugin "greeting"
    Then the conversation building "greeting" is beside the page
    And there should be no page errors
