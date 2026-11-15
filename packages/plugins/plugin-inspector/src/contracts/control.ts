/**
 * ONE KNOB, FOR WHOEVER HAS A VALUE AND A WAY TO WRITE IT — this package's
 * browser-only door, and the only one of its doors with a component behind it.
 *
 * ## What is being shared, exactly
 *
 * A plugin the vault defines has a page of its own, and that page draws the
 * plugin's settings. They are the SAME settings this panel's rows draw, read
 * off the same `configurationValues` on the same roster and written through the
 * same `plugins.configure`: a text leaf is a box, a bounded number asks for the
 * numeric keyboard, four-or-fewer choices are segmented buttons and more are a
 * select, a file-authored value wears a ● and a ↺ beside it, Enter saves,
 * Escape restores, and a blur the APP caused is not a save. None of that is a
 * fact about the plugins panel. All of it is what a settings control in this
 * product IS, and a page that re-derived it would be a second answer to every
 * one of those questions — the kind that agrees for a release and then quietly
 * does not, on the half nobody opened this week.
 *
 * So the control crosses the boundary as A STATELESS FACE OVER DATA THE CALLER
 * SUPPLIES. It takes the row's name, one reading, a `configure` verb and an
 * optional frozen sentence, and it holds exactly one thing of its own: the
 * draft under this reader's caret, which belongs to the mounted control and
 * dies with it. Two mounts are two independent drafts — the factory rule in
 * `docs/architecture/cordis.md` under *Choose the owner before the helper*,
 * which is what makes a component shareable at all. It reads no roster,
 * acquires no service, and asks nothing about who mounted it.
 *
 * ## ...and what is NOT
 *
 * NOT THE PANEL'S OWN READING. Nothing behind this door reaches `../state.ts`,
 * the held approval provider, the held preferences door or `browserManagement`.
 * A caller gets no answer to *which rows are expanded*, *what has this reader
 * approved* or *what is the roster now*, and could not get one: the modules
 * that hold those are not on this door's graph, which is a fact the door-graph
 * claim checks rather than a promise this comment makes. The page's own
 * component declares `browser-management` for itself and hands this function
 * what it read — the difference between sharing static mechanics and sharing
 * live plugin state.
 *
 * NOT `../rows.ts`, either. What is published beside the component is the
 * handful of pure readings the component itself needs — the key in words, the
 * compact spelling, the unit, the box's width, whether a value was authored and
 * where an authored one was authored — plus `rowValues`, which is how a caller
 * turns a roster row into the readings to pass in. The panel's walk, its
 * grouping, its conditions and its freeze policy stay private: they are
 * decisions about A LIST OF EVERY PLUGIN, and a page about one plugin has no
 * use for them.
 *
 * ## Why a door of its own rather than `./contract`
 *
 * Because `.`/`./contract` is a static contract a SERVER graph may open — a
 * service tag and the slot declarations, nothing more — and everything here
 * pulls in Solid and `@olai/web`'s browser helpers. Putting a component behind
 * that door would put a UI runtime on the walk of every root that reads the
 * inspector's tags, which is what the door-graph claim exists to refuse. A
 * browser-only contract gets a browser-only subpath.
 */
export { Control } from "./Control.tsx"
export {
  configurationAuthored,
  controlOf,
  knobAuthored,
  knobLabel,
  knobUnit,
  knobWidth,
  labelOf,
  rowValues,
  type PolicyReading,
} from "./knobs.ts"
