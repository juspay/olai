@scratch:good
Feature: A definition reads its own schema knobs
  Scenario: Changing a knob re-applies approved source and the panel shows its author
    Given I open the outline "house.olai"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"blue"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    And I open the plugins panel
    When I expand settings for the plugin "swatch"
    Then the plugins panel shows "swatch" configured "tone" as "blue"
    And the plugin "swatch" marks "tone" as authored by "vault"
    Given a terminal agent is connected to the served directory
    When the terminal agent inspects definition configuration
    Then the definition layout names its Config properties and reserved keys
    When the terminal agent runs definition "swatch"
    Then the definition run reports "tone" as "blue" from "vault"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"red"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    Then the plugins panel says "swatch" is "tone=red"
    When I expand settings for the plugin "swatch"
    Then the plugins panel shows "swatch" configured "tone" as "red"
    When I rewrite "definition.olai" as:
      """
      {"id":"swatch-policy","ord":"a0","title":"A configured definition","custom":{"plugin":"swatch","approved":"always","tone":"blue"}}
      {"id":"swatch-server","ord":"a0","parent":"swatch-policy","title":"server.ts","desc":"import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\")), Schema.annotate({ description: \"the swatch tone\" })) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: (config) => config.tone === \"blue\" ? Effect.void : Effect.die(new Error(\"tone=\" + config.tone)) });"}
      """
    Then the plugins panel says nothing more about "swatch"
    When I expand settings for the plugin "swatch"
    Then the plugins panel shows "swatch" configured "tone" as "blue"
    And there should be no page errors

  Scenario: Definition controls edit their own node and preserve approval
    Given I open the app
    When I rewrite "definition.olai" as:
      """
      {"id": "edit-swatch", "ord": "a0", "title": "Editable swatch", "custom": {"plugin": "swatch", "approved": "always"}}
      {"id": "edit-server", "ord": "a0", "parent": "edit-swatch", "title": "server.ts", "desc": "import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.Literals([\"blue\", \"red\"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\"))), bright: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))), size: Schema.Int.check(Schema.isBetween({minimum: 1, maximum: 10})).pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))), shape: Schema.Literals([\"circle\", \"square\", \"star\", \"oval\", \"line\"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"circle\"))) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: () => Effect.void });"}
      """
    And I open the plugins panel
    And I expand settings for the plugin "swatch"
    And I pick "red" for "swatch" setting "tone"
    Then file "definition.olai" has namespace "swatch" setting "tone" as "red"
    And the plugins panel shows "swatch" configured "tone" as "red"
    And file "definition.olai" has namespace "swatch" setting "approved" as "always"
    And the "swatch" setting "size" is an integer input from 1 to 10
    When I toggle "swatch" setting "bright"
    Then file "definition.olai" has namespace "swatch" setting "bright" as "yes"
    When I type "7" into "swatch" setting "size"
    And I press "Enter" in "swatch" setting "size"
    Then file "definition.olai" has namespace "swatch" setting "size" as "7"
    When I select "star" for "swatch" setting "shape"
    Then file "definition.olai" has namespace "swatch" setting "shape" as "star"
    When I use the default for "swatch" setting "tone"
    Then file "definition.olai" has namespace "swatch" setting "tone" as "<absent>"
    And the plugins panel shows "swatch" configured "tone" as "blue"
    And the plugin "swatch" marks "tone" as authored by "default"
    And there should be no page errors

  Scenario Outline: The browser configure procedure refuses a definition identity or approval key
    Given the next browser configuration request names reserved key "<key>"
    And I open the app
    When I rewrite "definition.olai" as:
      """
      {"id": "edit-swatch", "ord": "a0", "title": "Editable swatch", "custom": {"plugin": "swatch", "approved": "always"}}
      {"id": "edit-server", "ord": "a0", "parent": "edit-swatch", "title": "server.ts", "desc": "import { definePlugin } from \"@olai/plugin-api\"; import { Effect, Schema } from \"effect\"; const Config = Schema.Struct({ tone: Schema.Literals([\"blue\", \"red\"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"blue\"))), bright: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))), size: Schema.Int.check(Schema.isBetween({minimum: 1, maximum: 10})).pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))), shape: Schema.Literals([\"circle\", \"square\", \"star\", \"oval\", \"line\"]).pipe(Schema.withDecodingDefaultKey(Effect.succeed(\"circle\"))) }); export default definePlugin({ name: \"swatch\", needs: [], config: Config, apply: () => Effect.void });"}
      """
    And I open the plugins panel
    And I expand settings for the plugin "swatch"
    And I remember the settings file "definition.olai"
    And I pick "red" for "swatch" setting "tone"
    Then the "swatch" setting "tone" problem says "<key> is reserved for the definition's name and approval"
    And the remembered settings file is unchanged
    And there should be no page errors

    Examples:
      | key      |
      | plugin   |
      | approved |
