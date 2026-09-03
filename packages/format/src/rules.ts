/**
 * THE WHOLE-SET RULES, each written over THE RECORDS IT IS ASKED ABOUT.
 *
 * These are the six rules `./validate.ts` runs and the sentences they say; what
 * this module adds to the shape they had is one parameter. A rule that used to
 * be handed the corpus and walk it is handed a LIST and walks that, so the full
 * validator asks each of them about every record in the directory and the
 * incremental one ({@link ./incremental.ts}) asks the same function about the
 * records an edit could have changed. There is still exactly one place each
 * finding is written, which is the rule `./validate.ts`'s header has always
 * made — and it is the rule that makes a shadow worth running at all: two
 * validators that spelled `unknown-parent` twice would diverge on the wording
 * long before they diverged on a verdict, and the divergence log would be full
 * of noise nobody could act on.
 *
 * THE THREE CYCLE RULES are the exception and stay whole-corpus. A loop is a
 * claim about the graph rather than about a record, and the walk that finds one
 * carries a memo across the corpus ({@link findCycles}), so a walk seeded from
 * a subset is not the same walk with less work — it is free to find a different
 * set of simple cycles. What the incremental validator narrows there is not the
 * walk but HOW OFTEN it runs (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/model-indices.md:57`): never
 * on an edit that left the graph where it was.
 *
 * WHAT A REPORT IS lives here too ({@link reportOf}), for the same one-place
 * reason. The error scope — what a file that did not parse withholds, and what
 * order the findings come out in — is part of the verdict, so both arms reach
 * it through one function rather than each assembling a list that sorts almost
 * the same.
 *
 * Nothing here is exported through `./index.ts`. These are the validator's
 * insides, published to exactly one module above them and to the tests that
 * hold the two arms to one answer.
 */


import { type Derived, drawnFrom } from "./derive.ts"
import { resolveRelative } from "./documents.ts"
import {
  chainOf,
  compareErrors,
  isGuessWhileUnreadable,
  type OutlineError,
  type Related,
} from "./errors.ts"
import {
  isMirror,
  isRegular,
  type Located,
  type LocatedRegular,
  mintedInto,
  PROPERTIES,
  propertiesIn,
  type Site,
} from "./node.ts"
import { byPath } from "./paths.ts"
import { markdownIn, type OutlineSet } from "./set.ts"
import { didYouMeanDeclared } from "./suggest.ts"
import {
  type ContributedKind,
  declaredFor,
  heldCustoms,
  keyOf,
  type KindVocabulary,
  listed,
  NAMED_AT_MOST,
  resolvesId,
  type Typed,
  wrongDeclaration,
  wrongValue,
} from "./typing.ts"

// ── the verdict ────────────────────────────────────────────────────────

/**
 * THE REPORT: the parse errors first, whatever the rules withheld taken out,
 * and the whole thing in presentation order.
 *
 * NOTHING REFUSES ANY MORE, which is what this sentence used to say and what
 * the per-file ruling took away. It read "the findings, as the caller of a
 * REFUSED validation sees them"; a validation answers with a set whatever it
 * finds, so this is what a PUBLISHED set's `broken` is cut from — filed under
 * the files each finding breaks (`./verdict.ts`'s `blamed`) and drawn on those
 * files' own pages.
 *
 * It is `./validate.ts`'s closing paragraphs, moved here so that both arms of
 * the validator reach it. Comparing two lists of raw findings would be
 * comparing something no reader ever sees; comparing two reports is comparing
 * the product.
 */
export const reportOf = (
  set: OutlineSet,
  errors: ReadonlyArray<OutlineError>,
): ReadonlyArray<OutlineError> => {
  const unreadable = set.broken.flatMap((file) => [...file.errors])
  // A file that did not parse contributes no ids, so a reference resolving to
  // nothing may be pointing straight into it. That is a GUESS, and the format's
  // staging rule is that guesses are not reported ({@link ./errors.ts}'s
  // catalogue says which codes are guessable): "`kitchen` is not a known id" is
  // not a finding when the line declaring `kitchen` is the one that failed to
  // parse.
  const found = set.broken.length === 0
    ? errors
    : errors.filter((error) => !isGuessWhileUnreadable(error))
  return [...unreadable, ...found].sort(compareErrors)
}

/**
 * The paths a `doc` may point at: the set's `.md` files, as a membership test.
 *
 * Lifted out of {@link reportDocs} so that the ledger one validation leaves the
 * next can carry it ({@link ./incremental.ts}): building this is a walk of
 * every document in the directory, which is a whole-corpus cost the write gate
 * paid per write for a set whose documents nearly never move.
 *
 * A PATH DECIDES IT, which is what makes that carry exact. `markdownIn` filters
 * on `Document.kind`, and a document's kind is `./kinds.ts`'s answer about its
 * NAME — a `.md` that would not open still keeps its place in the set as an
 * empty document of its own kind ({@link ./set.ts}'s `assemble`). So a path is
 * in this set exactly when the set holds that path and the registry calls it a
 * document, and a delta naming files is enough to keep the set current without
 * re-walking the directory. `./incremental.test.ts` holds the carried set
 * against this walk on every revision it replays rather than taking the
 * paragraph's word for it.
 */
export const markdownPaths = (set: OutlineSet): ReadonlySet<string> =>
  new Set(markdownIn(set).map((document) => document.path))

// ── ids ────────────────────────────────────────────────────────────────

/** A duplicate is reported once, on the second record, pointing back at the
 *  first: the first one is not the mistake. `derive` keeps that first claim,
 *  so the reference rules below still resolve — reporting a hundred dangling
 *  edges because an id was declared twice would bury the one error worth
 *  reading. */
export const reportDuplicateIds = (
  records: Iterable<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of records) {
    const first = derived.byId.get(located.node.id)
    if (first === undefined || first === located) continue
    errors.push({
      code: "duplicate-id",
      ...siteOf(located),
      message: `\`${located.node.id}\` is already the id of another node; ids are unique across every file in the served directory`,
      related: [{ ...siteOf(first), note: "first declared here" }],
    })
  }
}

// ── references ─────────────────────────────────────────────────────────

/**
 * What one record's `parent` answers for — the three findings a placement can
 * earn on its own, without the loop check below.
 *
 * SPLIT FROM THE CYCLE WALK, which used to be this rule's last statement, and
 * the split is the whole of what the narrowing needs: these three are decided
 * by the record and the id it names, so they can be re-asked of a handful of
 * records; the loop is decided by the graph, so it cannot.
 */
export const reportParents = (
  records: Iterable<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of records) {
    const { file, node } = located
    if (node.parent === undefined) continue

    const parent = derived.byId.get(node.parent)
    if (parent === undefined) {
      errors.push({
        code: "unknown-parent",
        ...siteOf(located),
        message: `\`parent\` is \`${node.parent}\`, which no node declares${suggest(node.parent, derived)}`,
      })
      continue
    }
    if (parent.file !== file) {
      errors.push({
        code: "foreign-parent",
        ...siteOf(located),
        message: `\`parent\` is \`${node.parent}\`, which lives in another file; every \`.olai\` is an independent tree, so cross-file placement is a \`mirror\``,
        // `broken: false` — the parent is a POINTER, not a second fault. This
        // record reached across; the record it reached at did nothing, is
        // named so the reader can see where the `parent` went, and keeps its
        // page lit and its writes admitted ({@link ./errors.ts}'s `Related`).
        // The fix is one edit and it is in THIS file — the `parent` this line
        // holds, or the mirror that should have been written instead — so
        // darkening the other end bought a reader nothing and cost that file
        // every write in it (`broken-file-blocks-healthy-writes`).
        related: [{ ...siteOf(parent), note: "the parent lives here", broken: false }],
      })
      continue
    }
    if (isMirror(parent.node)) {
      errors.push({
        code: "parent-not-a-node",
        ...siteOf(located),
        message: `\`parent\` is \`${node.parent}\`, which is a mirror; children hang off the node a mirror points at, never off the mirror`,
        related: [{ ...siteOf(parent), note: "the mirror is here" }],
      })
    }
  }
}

/** `parent` pointers that close a loop, walked child-to-parent over the whole
 *  corpus — see this module's header for why a cycle walk is the one rule that
 *  is not narrowed by asking it about fewer records. */
export const reportParentCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  reportCycles(
    findCycles(all, derived, (node) => (node.parent === undefined ? [] : [node.parent])),
    "parent-cycle",
    "`parent` pointers close a loop, so this node is its own ancestor",
    errors,
  )
}

/**
 * The ids nothing declares, in the order {@link Derived.namedBy} holds them —
 * which is the order the corpus first names each one.
 *
 * The whole-corpus arm's answer to "which references dangle", and it is already
 * an index read rather than a walk of the records ({@link reportUnknownTargets}
 * says what that bought). The incremental arm arrives at the same list from the
 * other end — the handful of ids an edit could have moved — and puts it in this
 * order rather than inventing one of its own.
 */
export const danglingIn = (derived: Derived): ReadonlyArray<string> => {
  const dangling: Array<string> = []
  for (const id of derived.namedBy.keys()) if (!derived.byId.has(id)) dangling.push(id)
  return dangling
}

/**
 * Asked ONCE PER NAMED ID, of the index that is `targetsOf` read backwards
 * ({@link Derived.namedBy}), rather than once per record of the corpus.
 *
 * `targetsOf` is still the format's own list of what a record points at — this
 * rule reads the index derive built by asking it, so there is still exactly one
 * list of edge fields, and the day a fourth relation arrives this rule sees it
 * without being told. What changes is the direction: the question "does
 * everything this names exist?" is the same question as "is this named id
 * declared?", and the second one has as many answers as there are ids named,
 * not as there are records.
 *
 * ERROR ORDER, which is the whole reason this waited for its own change
 * (`check-targets-index`, deferred from #205). The report is SORTED before
 * anyone sees it — by file, then line, then code ({@link ./errors.ts}'s
 * `compareErrors`) — so the only findings this can reorder are two at the SAME
 * site with the same code: one record naming two ids that nothing declares.
 * Those used to come out in the order the record writes its fields; they now
 * come out in the order the CORPUS first names those ids, which for a record
 * naming ids nobody else names is the same order, and differs only when an
 * earlier record named one of them first. Both are arbitrary and both are
 * deterministic; what is preserved is what a reader spends — one finding per
 * field per record, at that record's own site, naming the field it was written
 * with.
 *
 * THAT ORDER IS NOW A PROMISE TO A SECOND CALLER, which is what the `dangling`
 * parameter is. The incremental validator finds the same ids by asking which
 * of them an edit could have moved, and it has to hand them over in this order
 * or the two arms would put one record's two findings in two orders — the same
 * bytes on disk producing a different report depending on how the reader got
 * there, which is the failure {@link ./patch.ts} keeps `namedBy`'s key order
 * for in the first place.
 *
 * ONE thing is deliberately not preserved: a record naming the same unknown id
 * TWICE IN ONE FIELD (`"after":["x","x"]`, which only a hand-edited file can
 * hold — no op writes a repeat) used to be two identical findings and is now
 * one. The index folds a record's fields, and two copies of one sentence at one
 * site tell a reader nothing the first did not.
 */
export const reportUnknownTargets = (
  dangling: Iterable<string>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const id of dangling) {
    // Once per unknown id rather than once per record naming it: the sentence
    // is the same for every one of them, and the suggestion behind it is a
    // question about every declared id in the set.
    const said = suggest(id, derived)
    for (const naming of derived.namedBy.get(id) ?? []) {
      for (const field of naming.fields) {
        errors.push({
          code: "unknown-target",
          ...siteOf(naming.at),
          message: `\`${field}\` names \`${id}\`, which no node declares${said}`,
        })
      }
    }
  }
}

/** The ordering graph is `derive`'s (`blocks` normalised into `after`, in the
 *  one place that happens), so this rule and the blockedness the view draws
 *  are reading the same edges rather than two normalisations that could
 *  disagree. That graph is in terms of NODES — an edge naming a mirror is an
 *  edge to the node standing there — which is what makes a deadlock closing
 *  through a placement one loop this walk can find, rather than two dead ends
 *  the view drew as blocked and nothing ever refused.
 *
 *  This is where the two part company: blockedness exempts what has been put
 *  away and what nobody marked, because it is about what is on a plate. A
 *  cycle exempts NOTHING — it is a claim about the file, and an `after` loop is
 *  one whether or not it is archived, and whether or not anyone marked it. */
export const reportAfterCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  reportCycles(
    findCycles(all, derived, (node) => derived.after.get(node.id) ?? []),
    "after-cycle",
    "`after` (with `blocks` normalised into it) closes a loop, so nothing in it can start first",
    errors,
  )
}

/** A mirror shows a subtree somewhere else. Placing one inside the subtree it
 *  shows means expanding it never terminates, so the graph a renderer actually
 *  walks has to be acyclic.
 *
 *  That graph is {@link drawnFrom}, and it runs DOWNWARD. Note this is the
 *  opposite direction from the parent check above, which walks child-to-parent
 *  — either direction finds a pure parent loop, but only the downward one
 *  finds the mirror case, because a mirror's edge to its target is downward by
 *  nature. Mixing the two directions in one walk finds neither reliably. The
 *  ops layer walks the same graph to refuse the placement BEFORE the write,
 *  which is why it is a derivation rather than a lambda here. */
export const reportMirrorCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  const cycles = findCycles(all, derived, (node) => drawnFrom(derived, node))

  reportCycles(
    // A cycle with no mirror in it is a parent cycle, already reported by
    // `reportParentCycles` — saying it twice in two vocabularies helps nobody.
    cycles.filter((cycle) => cycle.some((located) => isMirror(located.node))),
    "mirror-cycle",
    "this mirror is placed inside the subtree it shows, so expanding it never ends",
    errors,
  )
}

// ── documents ──────────────────────────────────────────────────────────

/** `doc` is relative to the outline that names it — that is what "attached"
 *  means — so it is resolved against the outline's own directory ({@link
 *  ./documents.ts}, the one place that arithmetic lives) and matched against
 *  the `.md` files actually found.
 *
 *  DOCUMENTS, not every bodied file. The set's `documents` list carries each
 *  `.html` too since they are read the same way, and a membership test alone
 *  would therefore have quietly widened what `doc` may point at — to a file the
 *  surfaces that draw an attachment cannot draw (a reference under a row is one
 *  line of markdown, and a zoomed node draws the whole document through the
 *  markdown pipeline; neither is a sealed frame). So the kind is asked —
 *  through {@link markdownPaths}, which narrows through `markdownIn`, the one
 *  narrowing that answers it for the validator, the planner and both document
 *  reads alike — and the message below stays true. */
export const reportDocs = (
  records: Iterable<Located>,
  known: ReadonlySet<string>,
  errors: Array<OutlineError>,
): void => {
  for (const located of records) {
    const { file, node } = located
    if (isMirror(node) || node.doc === undefined) continue
    const resolved = resolveRelative(file, node.doc)
    if (known.has(resolved)) continue
    errors.push({
      code: "missing-doc",
      ...siteOf(located),
      message: `\`doc\` is \`${node.doc}\`, which resolves to \`${resolved}\` — no such \`.md\` file is served`,
    })
  }
}

// ── typed properties ───────────────────────────────────────────────────

/**
 * The DECLARATIONS themselves — every record of `_olai/Properties.olai`, held
 * against the built-in table ({@link ../typing.ts}'s `BOOTSTRAP`).
 *
 * WHOLE-FILE AND NOT NARROWED, and it is the one rule here that needs no
 * narrowing argument: a declarations file is one node per key that a vault
 * actually types, which is a handful — so re-asking it costs a walk of a few
 * dozen records where deciding whether to re-ask it would cost about the same.
 * The duplicate-key half needs the file's roots IN ORDER anyway (the second
 * claim is the one reported, as it is for a duplicate id), which a subset
 * cannot give.
 *
 * A directory with no such file reports nothing, because it declares nothing.
 *
 * `kinds` IS THE ONE THING THIS RULE ASKS THAT IS NOT A READING OF THE SET, and
 * it is the BUILT half of it that decides here ({@link ../typing.ts}'s
 * `KindVocabulary`): a `type` naming a kind this binary knows how to mean is a
 * legal declaration whether or not `--plugins` left that plugin out, where
 * `type: banana` is refused with every legal word named. The value side of the
 * same vocabulary is the ENABLED half and is asked one rule down — which is the
 * whole of what "a disabled plugin's kind validates as plain text" comes to.
 */
export const reportDeclarations = (
  derived: Derived,
  kinds: KindVocabulary,
  errors: Array<OutlineError>,
): void => {
  const file = propertiesIn(derived.byFile.keys())
  if (file === undefined) return
  const declared = new Set<string>()
  // THE FILE'S RECORDS IN LINE ORDER, which is the order the READING walks too
  // ({@link ../typing.ts}'s `declaringIn0` argues why the two must be one
  // order), and the keys are collected FOLDED through the same `keyOf` — so
  // "the first declaration wins" and "the second claim is reported" are two
  // sentences about one record rather than two answers about two.
  for (const located of derived.byFile.get(file) ?? []) {
    const wrong = wrongDeclaration(derived, located, declared, kinds)
    if (wrong === undefined) {
      if (isRegular(located) && located.node.parent === undefined) {
        const key = keyOf(located.node.title)
        if (key !== undefined) declared.add(key)
      }
      continue
    }
    // ACROSS-FILES IS THE FINDING'S, not the code's: only the `under` arm
    // reads the set, so only it could have been invented by a file that did not
    // parse (`./typing.ts`'s `Wrong`, and `./errors.ts`'s `Reach`). A
    // declaration that says no `type` at all is true whatever is missing.
    errors.push({
      code: "bad-prop",
      ...siteOf(located),
      message: wrong.said,
      ...(wrong.across ? { across: true } : {}),
    })
  }
}

/**
 * Every property VALUE these records carry, against what its key declares.
 *
 * ONE FINDING PER KEY PER RECORD, in the order the record's own map holds them
 * (`heldCustoms` — {@link ../custom.ts}'s `customOrder`, the order the bytes
 * have them), which is what {@link reportUnknownTargets} promises one rule
 * over for the same reason: the report is sorted by file, then line, then
 * code, so the only findings this can order are two at ONE site with this
 * code, and both validators have to put them in the same one. The declaration
 * door walks the same iterator, so a value this reports and a declaration
 * does not refuse cannot happen.
 *
 * A MIRROR CARRIES NO PROPERTIES — the format's own shape — so a placement is
 * stepped over rather than asked, exactly as `reportDocs` steps over one.
 *
 * The finding is about TWO places, and says so: the record that holds the
 * value and the declaration that judged it ({@link judgedFrom}). The second
 * is not decoration — every reader of `implicatedBy` (the error view, the
 * banner, the write gate one layer up, and the drift check the refusal arm
 * asks) can name only the files a finding names, and a stale-set refusal
 * whose stale half is the declarations file is one a bare `bad-prop` would
 * answer with the wrong file.
 *
 * NOTHING WALKS. The declarations are one small map built once per validation,
 * `ref` and `node` read `byId` and `children`, the declaring site is one
 * `byId` lookup through the id `Declared.at` pins, and `doc` reads the `.md`
 * set the `doc` field's own rule already carries — which is what lets this
 * rule ride every write rather than joining the whole-corpus sweep.
 */
export const reportPropValues = (
  records: Iterable<Located>,
  typed: Typed,
  errors: Array<OutlineError>,
): void => {
  // A vault that declares nothing has nothing to say about any value, and
  // that is nearly every vault: the map is read once here rather than per
  // record, so an undeclared directory pays one test for the whole rule.
  if (typed.declarations.size === 0) return
  for (const { located, key, value } of heldCustoms(records)) {
    const wrong = wrongValue(typed, located.file, key, value)
    if (wrong === undefined) continue
    // …and the same question on the value side, asked of the KIND the key
    // declares: a `ref` or a `node` resolves a bare id, and the other five are
    // decided by the record and the declarations file (`./typing.ts`'s
    // `resolvesId`).
    errors.push({
      code: "bad-prop",
      ...siteOf(located),
      message: wrong,
      related: judgedFrom(typed, key),
      ...(resolvesId(typed.declarations, key) ? { across: true } : {}),
    })
  }
}

/**
 * A KEY A KIND USED TO BE SPELLED AS, still held and still undeclared — ONE
 * finding, on the declarations file, quoting the row that ends it.
 *
 * ## What it is for
 *
 * A word core owned outright becomes a plugin's, and the plugin's kind composes
 * to a new one (`agent-session` becomes `chat-agent-session`). Every vault that
 * was already using the old key keeps its values — they are plain text, which
 * is what any undeclared key is — and loses the face and the fence with no
 * sentence anywhere saying why. The plugin cannot fix that by claiming the key:
 * a claim is set by the registry equal to the composed word, precisely so that
 * enabling a plugin can never take over a column somebody has been using for
 * something of their own ({@link ../typing.ts}'s `ContributedKind.wasCalled`
 * argues the whole of it). So olai says it instead, and a person writes one row.
 *
 * IT RIDES `enabled`. A serve that is not running the plugin has no business
 * nagging about its migration — the word means nothing here, the values are the
 * same plain text they are in a vault that never heard of it, and a finding
 * decided by a flag on the machine is the one thing a file's verdict may not be
 * ({@link ../typing.ts}'s `KindVocabulary`).
 *
 * IT IS A NO-OP THE MOMENT THE VAULT HAS SPOKEN, and it reads {@link
 * declaredFor} to find out — the folded map every other reader takes, AFTER the
 * two layers are folded ({@link ../typing.ts}'s `withClaims`, the one place
 * precedence lives). So a row declaring the key the new kind ends it, and so
 * does a row declaring it `text`, or `path`, or anything else at all: that is a
 * vault saying what the key means, which is the whole answer, and a rule that
 * went on nagging past it would be arguing with the person. Declaring it `text`
 * is the escape hatch, in the one place a reader already looks for one.
 *
 * ## Why the finding sits on the DECLARATIONS FILE
 *
 * Because a finding breaks the file it is found in, unconditionally
 * ({@link ../errors.ts}'s `filesOf`), and the file it breaks stops accepting
 * writes and has its content withheld from every page. One finding per
 * offending RECORD would therefore darken every outline holding a legacy value
 * — nine records on one board is one board off the screen and un-writable —
 * which is not a migration nudge, it is bricking the vault the feature lives
 * in. So the offending records are `related` sites marked `broken: false`: named
 * so a reader can see what is affected, lit and writable because they are
 * nobody's fault and no edit to them is the fix. It is {@link judgedFrom}'s
 * shape turned around — there, a record is blamed and its declaration is the
 * ground; here, the missing declaration is blamed and the records are.
 *
 * WHAT IT COSTS, NAMED RATHER THAN HIDDEN: the declarations file goes
 * errors-only until the row lands, so a vault's other declarations stop being
 * drawn and a write to that file is refused while the sentence stands. That is
 * loud, and it is the honest weight of "a kind this vault's records use is
 * declared by nobody". It cannot cascade — one finding per retired key, ended
 * by one row — and the write that ends it is admitted, because the gate judges
 * the set a commit WOULD make and that set has no finding in it.
 *
 * A VAULT WITH NO DECLARATIONS FILE has no such path in the set, so the site is
 * where one would be minted ({@link ../node.ts}'s `mintedInto`), at `line: 0` —
 * "there is no record to point at", the rule {@link ../errors.ts}'s `hasLine`
 * already spells for the two unreadable codes. It is the first finding filed on
 * a path the set does not hold, and that is the honest place for it: the fix is
 * to CREATE that file, and inventing a second answer to where a declarations
 * file goes would be the drift `mintedInto` exists to prevent.
 *
 * ## The records it is asked about
 *
 * The same set {@link reportPropValues} is asked about, and for the same reason
 * — this is a rule about values, narrowed by the same gate
 * ({@link ../incremental.ts}'s `walkingProps`). The narrowing is exact because
 * of the narrowed arm's own fact 2: a validation only narrows from a verdict
 * with NOTHING in it, so a record already holding a retired key would have put
 * this finding in that verdict and the narrowing would have declined. The one
 * way an untouched record becomes an offender is the declaration LEAVING, which
 * moves the typing and opens the same gate. So `fresh` is the whole answer when
 * that gate is shut, and the two arms cannot name different records.
 */
export const reportLegacyKeys = (
  records: Iterable<Located>,
  typed: Typed,
  errors: Array<OutlineError>,
): void => {
  // ASKED OF THE VOCABULARY FIRST, and that is what makes this rule free for
  // every vault that has no migration owed: nearly no kind carries a retired
  // spelling, and one that does stops being owed the moment the key is
  // declared. A walk of the records guarded by nothing would be a second
  // `heldCustoms` pass over the corpus on every write, for a sentence almost
  // nobody is owed.
  const owed = legacyOwed(typed)
  if (owed.size === 0) return

  // THE RECORDS PER KEY, in the order the walk meets them — `heldCustoms`'
  // order, which is the corpus's and then the record's own map's, exactly as
  // {@link reportPropValues} promises for two findings at one site.
  const held = new Map<string, Array<LocatedRegular>>()
  for (const { located, key } of heldCustoms(records)) {
    const folded = keyOf(key)
    if (folded === undefined || !owed.has(folded)) continue
    const found = held.get(folded)
    if (found === undefined) held.set(folded, [located])
    // ONE RECORD IS ONE RECORD, however many spellings of the key it wrote. A
    // hand-edited node carrying both `Sprocket` and `sprocket` is two of
    // `heldCustoms`' yields and one thing to fix, and the count is a sentence a
    // person reads. Comparing against the LAST is enough rather than a set,
    // because that walk yields one record's keys consecutively.
    else if (found[found.length - 1] !== located) found.push(located)
  }
  if (held.size === 0) return

  // THE FILE THE ROW GOES IN: the one this vault already declares in, or the
  // one it would mint. Found by name like every other convention
  // ({@link ../node.ts}'s `propertiesIn`), so a directory keeping its
  // declarations somewhere of its own is told to edit the file it has.
  const at = propertiesIn(typed.derived.byFile.keys()) ?? mintedInto(PROPERTIES)
  // IN THE VOCABULARY'S ORDER rather than the corpus's, which decides nothing a
  // reader sees: two findings would land at one site with one code, the report
  // sorts by file, line and code, and `Array.prototype.sort` is stable — so
  // both arms, asked of one table, put them in one order. In practice there is
  // one retired key in the tree at a time.
  for (const [key, kind] of owed) {
    const holding = held.get(key)
    if (holding === undefined) continue
    errors.push({
      code: "legacy-key",
      file: at,
      line: 0,
      message: legacySaid(key, kind, at, holding),
      // `broken: false`, and it is the whole of why this rule files one finding
      // instead of one per record: these records are what the sentence is
      // ABOUT, not what is wrong. Their pages stay lit and their writes stay
      // admitted ({@link ../errors.ts}'s `Related`).
      related: holding.slice(0, NAMED_AT_MOST).map((one) => ({
        ...siteOf(one),
        note: "held here",
        broken: false,
      })),
    })
  }
}

/** The retired spellings this SERVE is answering for and this VAULT has said
 *  nothing about — the two guards of the rule above, as one small map keyed the
 *  way the declarations are ({@link ../typing.ts}'s `keyOf`, so a kind that
 *  retired `Agent-Session` and a record that wrote `agent-session` are one key).
 *
 *  A kind whose retired spelling {@link keyOf} refuses — empty, a shadow field,
 *  or one of the bootstrap words — contributes nothing, for the reason the
 *  reading refuses those keys in the first place: they are not keys a vault can
 *  declare, so there is no row to name. */
const legacyOwed = (typed: Typed): ReadonlyMap<string, ContributedKind> => {
  const owed = new Map<string, ContributedKind>()
  for (const kind of typed.kinds.enabled.values()) {
    if (kind.wasCalled === undefined) continue
    const key = keyOf(kind.wasCalled)
    if (key === undefined || declaredFor(typed.declarations, key) !== undefined) continue
    owed.set(key, kind)
  }
  return owed
}

/**
 * THE SENTENCE, and it is a row rather than a reproach: what is held, what the
 * word is now, and the JSON a person pastes.
 *
 * THE WORD COMES OFF THE VOCABULARY — `kind.kind`, which is the COMPOSED word
 * by the time a table reaches this package (`@olai/plugin-api`'s `Kinds`
 * service composes it off the registering fiber) — and never a literal. This
 * module names no plugin and could not spell `chat-agent-session` if it wanted
 * to; what it can do is quote the word it was handed, which is the same word
 * the person has to type.
 *
 * THE RECORDS ARE CAPPED at {@link NAMED_AT_MOST} through {@link listed}, the
 * idiom a refusal over a roster already uses: a vault with two hundred of them
 * would otherwise put its whole node list in one sentence, which is the failure
 * that cap was written for.
 */
const legacySaid = (
  key: string,
  kind: ContributedKind,
  at: string,
  holding: ReadonlyArray<LocatedRegular>,
): string =>
  `\`${key}\` is held by ${holding.length} ${
    holding.length === 1 ? "record" : "records"
  } and nothing declares it — ${listed(holding.map((one) => one.node.id), ", ")}. ` +
  `It is the kind \`${kind.kind}\` now, and a plugin may only ever declare a key ` +
  `carrying its own name, so olai will not take this one over: one row in ` +
  `\`${at}\` moves it — ` +
  `\`{"id":"prop-${key}","ord":"a0","title":"${key}","custom":{"type":"${kind.kind}"}}\`. ` +
  `Declaring it \`text\` instead says the key is prose, and stops this being said.`

/**
 * THE OTHER PLACE a `bad-prop` is about: the declaration that judged the
 * value, as one `related` site.
 *
 * `Declared.at` is the declaring NODE's id, and `byId` reads it back —
 * first-declared-wins, the same reader the declaration itself was. The one
 * thing the id may not have is a node: the set `typed` is over can have lost
 * it between readings (a ledger re-judged past the declaration's own removal
 * is `./incremental.ts`'s case), and then the sentence is the whole of the
 * finding, exactly as before.
 *
 * An EMPTY ARRAY and not an `undefined` field, for the reason the four
 * emitting sites give one another: both orders land the finding, and the
 * rule the catalogue pays for is that one finding's shape is one shape.
 */
const judgedFrom = (typed: Typed, key: string): ReadonlyArray<Related> => {
  const declared = declaredFor(typed.declarations, key)
  const declaring = declared === undefined ? undefined : typed.derived.byId.get(declared.at)
  // `broken: false` — the declaration is the judge, not a broken file: named
  // but never darkened ({@link ./errors.ts}'s `Related`).
  return declaring === undefined
    ? []
    : [{ ...siteOf(declaring), note: "declared here", broken: false }]
}

// ── cycles ─────────────────────────────────────────────────────────────

/** Every simple cycle reachable through `edges`, each returned once. Unknown
 *  targets are skipped: a dangling reference is already its own error, and a
 *  graph walk that invented a node for it would report a second. */
const findCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  edges: (node: Located["node"]) => ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<Located>> => {
  const cycles: Array<ReadonlyArray<Located>> = []
  // One memo, not two: a node is only marked seen after its walk has left the
  // path, so `seen` already implies "not on the path" and a second settled set
  // could not disagree with it.
  const seen = new Set<string>()

  const walk = (located: Located, path: Array<Located>): void => {
    const id = located.node.id
    const at = path.findIndex((step) => step.node.id === id)
    if (at !== -1) {
      cycles.push(path.slice(at))
      return
    }
    if (seen.has(id)) return
    seen.add(id)

    path.push(located)
    for (const target of edges(located.node)) {
      const next = derived.byId.get(target)
      if (next !== undefined) walk(next, path)
    }
    path.pop()
  }

  for (const located of all) walk(located, [])
  return cycles
}

/** One error per cycle, anchored at its earliest record so the report is
 *  stable, with the rest of the loop as related sites in walk order. */
const reportCycles = (
  cycles: ReadonlyArray<ReadonlyArray<Located>>,
  code: OutlineError["code"],
  message: string,
  errors: Array<OutlineError>,
): void => {
  for (const cycle of cycles) {
    const ordered = rotateToEarliest(cycle)
    const [anchor, ...rest] = ordered
    if (anchor === undefined) continue
    errors.push({
      code,
      ...siteOf(anchor),
      // Closed by repeating the anchor, which is what makes it read as a loop
      // rather than as a list — the ops layer names one it is about to close
      // the same way ({@link ./errors.ts}'s `chainOf`).
      message: `${message}: ${
        chainOf([...ordered.map((step) => step.node.id), anchor.node.id])
      }`,
      related: rest.map((step) => ({ ...siteOf(step), note: "also in the loop" })),
    })
  }
}

const rotateToEarliest = (
  cycle: ReadonlyArray<Located>,
): ReadonlyArray<Located> => {
  let at = 0
  cycle.forEach((step, index) => {
    const best = cycle[at]
    if (best === undefined) return
    // CORPUS ORDER, which is the set's own path order and not a string compare
    // ({@link ./paths.ts}): the earliest step of a loop is the one a reader
    // meets first walking the directory.
    if (byPath(step.file, best.file) < 0 || (step.file === best.file && step.line < best.line)) {
      at = index
    }
  })
  return [...cycle.slice(at), ...cycle.slice(0, at)]
}

// ── shared ─────────────────────────────────────────────────────────────

/** The place a located record is at, without the record. Annotated with
 *  {@link Site} rather than with the pair written out again: this is the
 *  function every finding in this file gets its `file:line` from, so an
 *  inline `{file: string; line: number}` here would be the one spelling that
 *  goes on compiling after the others have been made to agree. */
const siteOf = ({ file, line }: Located): Site => ({ file, line })

/** "did you mean", over the ids the set declares. The rule itself is
 *  {@link ./suggest.ts}'s, because the ops layer refuses the same unknown
 *  target one moment earlier — at the plan, before the write — and two copies
 *  of the budget would be two answers to one question.
 *
 *  THE MAP AND NOT ITS KEYS, which is the whole of what `perf-didyoumean`
 *  changed here: a file with a dozen dangling references asks this a dozen
 *  times per write ({@link reportUnknownTargets}), and the door that takes the
 *  map answers off an index held against it rather than walking every id per
 *  ask. Same offer, ties included. */
const suggest = (id: string, derived: Derived): string =>
  didYouMeanDeclared(id, derived.byId)
