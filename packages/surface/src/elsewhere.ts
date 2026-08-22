/**
 * HOW MUCH OF A QUERY A PAGE IS NOT SHOWING, as the wire speaks it — the
 * number under the one search box, and the door that widens.
 *
 * `./narrowing.ts`'s arguments hold here word for word, and this file exists
 * because one of them lands the other way: that reading is bounded by the PAGE,
 * so it is a stream and costs a page-sized walk per published revision. This
 * one is bounded by the CORPUS. On the revision pulse it would put a whole-vault
 * match behind every write while any page is filtered, which is the
 * nine-walks-per-bulk-gesture defect `filter-rides-the-page` removed — so it is
 * a PROCEDURE, asked once per settled keystroke and left alone until the words
 * move (docs/brainstorming/one-search-box.md argues the trade).
 *
 * WHY IT IS A MEMBER AT ALL rather than arithmetic in the browser is
 * `@olai/format`'s `elsewhere.ts`, in full: the complement is a subtraction
 * only where the page's matches are a subset of the directory's, and the trash
 * is a page where the two sets are disjoint.
 *
 * THE SHAPES, and not the equivalence beside them — `./page.ts`'s rule: these
 * are `@olai/format`'s declarations, re-exported rather than re-declared, for
 * the reason `./search.ts` says at length.
 */

export {
  /** How many the query selects that this page does not draw, and the words it
   *  is about. */
  ElsewhereAnswer,
  /** Which page, and what was typed into its box. */
  ElsewhereRequest,
} from "@olai/format"
