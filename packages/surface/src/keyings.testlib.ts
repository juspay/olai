import { SchemaAST } from "effect"

export type Keying = "keyed" | "positional" | "mixed"

export const keyings = (
  schema: { readonly ast: SchemaAST.AST },
  field: string,
): ReadonlyMap<string, Keying> => {
  const found = new Map<string, Keying>()
  const seen = new Set<SchemaAST.AST>()

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
    if (SchemaAST.isOptional(property.type)) return false
    return !arms(property.type).some(SchemaAST.isNull)
  }

  const walk = (ast: SchemaAST.AST, path: string): void => {
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

