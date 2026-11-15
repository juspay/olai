@scratch:plugins
Feature: A plugin the vault defines reads its own schema knobs
  A server half may expose a `Config` schema exactly as a built row does, and
  what it gets for it is exactly what a built row gets: controls derived from
  the schema, descriptions as tips, a ● on an authored value, a ↺ that removes
  the property — drawn on the plugin's own page under *Settings* and in its row
  on the plugins panel.

  THE VALUES ARE IN `_olai/Settings.olai` WITH EVERYBODY ELSE'S, under a node
  titled with the plugin's word. There is no second settings namespace and
  nothing per machine: one file, one reader, one shape, whether the row came
  out of the build or out of the vault.

  AND A KNOB IS NOT CODE. The version is a hash of the two halves, so moving a
  setting re-applies the row without touching its approval — which is the whole
  point of a knob: a thing the owner can move without reading the source again.
  Three words cannot be knobs at all (`approved`, `on`, `builder`), and the last
  scenario is the door refusing one.

  `plugin_knobs` is the panel's half of this; the page's half — the same node,
  written from the other face — is in `the_plugin_page.feature`.

  Scenario: Changing a knob re-applies approved source and the panel shows its author
    Given I open the app
    When I rewrite "plugins/greeting/server.ts" as:
      """
      import { definePlugin } from "@olai/plugin-api"
      import { Effect, Schema } from "effect"

      const Config = Schema.Struct({
        tone: Schema.Literals(["blue", "red"]).pipe(
          Schema.withDecodingDefaultKey(Effect.succeed("blue")),
          Schema.annotate({ description: "the swatch tone" }),
        ),
      })

      export default definePlugin({
        name: "greeting",
        needs: [],
        config: Config,
        apply: (config) => config.tone === "blue" ? Effect.void : Effect.die(new Error("tone=" + config.tone)),
      })
      """
    And I approve the plugin "greeting"
    And I always trust changes to the plugin "greeting"
    And I open the plugins panel
    And I expand the plugin "greeting"
    Then the plugins panel shows "greeting" configured "tone" as "blue"
    And the plugin "greeting" marks "tone" as authored by "default"

    # THE AGENT IS TOLD THE LAYOUT rather than left to remember it: the folder's
    # three names, the file consent lives in, and the three words a `Config` may
    # not declare.
    Then the plugin layout names the folder, the settings file and the reserved words
    When the terminal agent runs the plugin "greeting"
    Then the plugin run reports "tone" as "blue" from "default"

    When I pick "red" for "greeting" setting "tone"
    # THE ROW IS RE-APPLIED, with the new value, and the plugin's own `apply`
    # dies on it — so the panel says the plugin's own sentence. The approval was
    # never consulted, which is the claim: a setting is not a version.
    Then the plugins panel says "greeting" is "tone=red"
    And file "_olai/Settings.olai" has namespace "greeting" setting "tone" as "red"
    And the plugin "greeting" marks "tone" as authored by "vault"
    When the terminal agent runs the plugin "greeting"
    Then the plugin run reports "tone" as "red" from "vault"

    When I use the default for "greeting" setting "tone"
    Then the plugins panel says nothing more about "greeting"
    And file "_olai/Settings.olai" has namespace "greeting" setting "tone" as "<absent>"
    And there should be no page errors

  Scenario: Every control the schema can ask for writes the plugin's own node
    Given I open the app
    When I approve the plugin "greeting"
    And I open the plugins panel
    And I expand the plugin "greeting"
    Then the "greeting" setting "size" is an integer input from 1 to 10
    And the "greeting" setting "tone" is described as "the colour to greet in"

    When I pick "red" for "greeting" setting "tone"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "tone" as "red"
    When I toggle "greeting" setting "bright"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "bright" as "yes"
    When I type "7" into "greeting" setting "size"
    And I press "Enter" in "greeting" setting "size"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "size" as "7"
    When I select "star" for "greeting" setting "shape"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "shape" as "star"

    When I use the default for "greeting" setting "tone"
    Then file "_olai/Settings.olai" has namespace "greeting" setting "tone" as "<absent>"
    And the plugins panel shows "greeting" configured "tone" as "blue"
    And the plugin "greeting" marks "tone" as authored by "default"
    # ...AND THE APPROVAL IS WHERE IT WAS. Four writes to the plugin's node, and
    # not one of them touched the two properties that decide whether code runs.
    And file "_olai/Settings.olai" has namespace "greeting" setting "on" as "yes"
    And there should be no page errors

  Scenario Outline: The browser configure procedure refuses a reserved word
    # `approved` is the person's approval of code, `on` is their switch, and
    # `builder` is the conversation writing it. A `Config` that declared any of
    # them would be a plugin whose settings control its own consent — so the
    # door refuses the write before anything reaches the file, with the same
    # sentence either way.
    Given the next browser configuration request names reserved key "<key>"
    And I open the app
    When I approve the plugin "greeting"
    And I open the plugins panel
    And I expand the plugin "greeting"
    And I remember the settings file "_olai/Settings.olai"
    And I pick "red" for "greeting" setting "tone"
    Then the "greeting" setting "tone" problem says "<key> is reserved for the plugin's approval, its switch and the conversation building it"
    And the remembered settings file is unchanged
    And there should be no page errors

    Examples:
      | key      |
      | approved |
      | on       |
      | builder  |
