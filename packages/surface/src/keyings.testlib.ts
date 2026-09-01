/**
 * IS THIS FIELD AN IDENTITY, everywhere inside this schema — the walk a member's
 * `arrayKey` declaration is held to.
 *
 * PUBLISHED AS A TESTLIB, and the reason is the plugin extraction: a member's
 * `arrayKey` is a claim about the SCHEMA that member carries, and members are
 * declared in the package that owns them now — `olai-plugin-odu`'s `ci` cell
 * declares `id` and reaches two array depths with it. That claim has to be
 * holdable where the member is, and the alternative was each plugin growing its
 * own copy of a fifty-line AST walk: a second opinion about the very thing
 * under test, which is exactly the drift `@olai/format`'s own `./testlib` was
 * consolidated to stop.
 *
 * NOT PRODUCT, deliberately. Nothing in a running olai walks a schema to ask
 * this — juspay/kolu#2190 ships no boot-time check on purpose, and the
 * paragraph below says why.
 */

import { SchemaAST } from "effect"

/**
 * WHICH ARRAYS A DECLARED `arrayKey` ACTUALLY KEYS — read off the member's own
 * schema, so a rename has to come to the declaration.
 *
 * The declaration and the field it names live in two places, and a rename of
 * one silently orphans the other: an `arrayKey` no element carries reads as "no
 * identity declared" at the merge, so every row of that member goes back to
 * being REPLACED per frame with nothing red anywhere — which is the audit's
 * 2.11, the finding this pin bump is about, quietly coming back.
 *
 * A PER-SITE GUARD, which is the pattern kolu ships beside its own declaration
 * (`packages/common/src/surface.test.ts`, "names a field the forward schema
 * actually carries") and the reason juspay/kolu#2190 ships no boot-time check:
 * a walk that ran at construction would have to survive every codec an app can
 * write — recursive, `suspend`ed, hand-built — and a FALSE boot crash on a
 * legitimate declaration is worse than the mis-declaration it catches. In a
 * test the walk is safe, because the schemas it walks are named one by one.
 *
 * It checks the harder half too, which kolu's docstrings state and no code
 * enforces: the field must be REQUIRED and NON-NULLABLE. `reconcile` decides
 * keyed-versus-positional for a whole array from its FIRST element's value, so
 * an optional key lets whichever row happens to be first decide for every other
 * row in that frame — which cannot corrupt anything and silently drops that
 * frame back to the undeclared behaviour, which is the whole thing the
 * declaration was for.
 */
export type Keying = "keyed" | "positional" | "mixed"

/** Every array inside a schema, and whether `field` identifies its elements:
 *  `keyed` (every arm carries it, required and non-nullable), `positional`
 *  (no arm carries it — merged by index, which is silent on a repeated frame
 *  just the same), or `mixed`, which is the one nobody may ship.
 *
 *  Over `SchemaAST`, which `effect` exports with the union and the narrowing
 *  guards already on it — there is nothing here to hand-roll but the question. */
export const keyings = (
  schema: { readonly ast: SchemaAST.AST },
  field: string,
): ReadonlyMap<string, Keying> => {
  const found = new Map<string, Keying>()
  const seen = new Set<SchemaAST.AST>()

  /** Through a `suspend` and into a union's arms — the shapes an element can be
   *  spelled as before it is an object with fields. */
  const arms = (ast: SchemaAST.AST): ReadonlyArray<SchemaAST.AST> =>
    SchemaAST.isSuspend(ast)
      ? arms(ast.thunk())
      : SchemaAST.isUnion(ast)
      ? ast.types.flatMap(arms)
      : [ast]

  const carries = (arm: SchemaAST.AST): boolean => {
    if (!SchemaAST.isObjects(arm)) return false
    const property = arm.propertySignatures.find((one) => one.name === field)
    if (property === undefined) return false
    // Required and non-nullable, both asked of the property's own type through
    // the module that owns the answer: optionality moved off the node between
    // effect 3 and 4, and reading `context.isOptional` by hand is a guard that
    // would quietly start saying "not optional" the next time it moves.
    if (SchemaAST.isOptional(property.type)) return false
    return !arms(property.type).some(SchemaAST.isNull)
  }

  const walk = (ast: SchemaAST.AST, path: string): void => {
    // A row's `children` is the same array wherever it is reached from, and it
    // holds rows, so the walk would not otherwise end.
    if (seen.has(ast)) return
    seen.add(ast)
    if (SchemaAST.isSuspend(ast)) return walk(ast.thunk(), path)
    if (SchemaAST.isUnion(ast)) {
      for (const one of ast.types) walk(one, path)
      return
    }
    if (SchemaAST.isArrays(ast)) {
      const elements = [...ast.elements, ...ast.rest]
      const objects = elements.flatMap(arms).filter(SchemaAST.isObjects)
      if (objects.length > 0) {
        const carrying = objects.filter(carries).length
        found.set(
          path,
          carrying === 0 ? "positional" : carrying === objects.length ? "keyed" : "mixed",
        )
      }
      for (const one of elements) walk(one, `${path}[]`)
      return
    }
    if (SchemaAST.isObjects(ast)) {
      for (const property of ast.propertySignatures) {
        const name = String(property.name)
        walk(property.type, path === "" ? name : `${path}.${name}`)
      }
    }
  }

  walk(schema.ast, "")
  return found
}

/**
 * EVERY MEMBER, and the schema whose arrays its key would govern — read off the
 * spec rather than written down beside it.
 *
 * The docstring above says the hazard is "a declaration and the field it names
 * live in two places". A guard that imported four schemas by hand and named four
 * members by hand would be a third place, with the same failure: point `pins` at
 * a different schema and the check goes on passing against the old one, and add
 * a member tomorrow with a key its value does not carry and nothing is red.
 *
 * `arrayKey` is read through a widening because the spec is a LITERAL: a member
 * that does not spell the field has no such property to name, so the question
 * has to be asked of the value.
 */
