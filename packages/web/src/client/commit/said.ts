/**
 * What a change is CALLED on screen.
 *
 * The panel never shows a text diff, and this is the whole reason it does not
 * have to: a `.olai` diff is one enormous line per node with everything on it
 * changing at once, and what a reader actually wants is the sentence. So
 * `@olai/format` classifies a change into one `Sort` — once, on the server,
 * from the fields that differ and what they became — and this is the table that
 * turns that into words a person reads.
 *
 * What one CHANGE is called — *marked done*, *note rewritten* — is not here:
 * it moved to `../changes.ts` when the chat transcript started drawing an olai
 * write in the same words. Those two are one vocabulary about one event seen at
 * two moments, and a second table is the day one of them starts saying
 * something else. What stayed is everything about the PILL and the panel, which
 * nothing else reads.
 */

import {
  type How,
  type Pending,
  type Reason,
  type RepoState,
  type Writer,
} from "@olai/format"
import type { GitState } from "@olai/surface"

/**
 * Which of the eight things the pill is saying right now.
 *
 * EIGHT, and every one of them is drawn — the control is never absent. This
 * feature exists to be an audit trail of what the tool wrote, so "there is no
 * audit trail here" is the single most important thing it can say, and a pill
 * that disappeared is exactly how a person would never find that out. The same
 * argument the connection dot makes: green is a claim the page keeps making,
 * and an indicator that is only there when something is wrong cannot be trusted
 * when it is absent.
 *
 * `off` and `no-repo` are SETTINGS rather than faults, and are drawn as such:
 * dim, inert, no warning. `blocked` and `error` are the two a person can act
 * on, so they are the two that get a warning.
 *
 * `error` is the newest, and it is the whole of `one-git-indicator`: it is
 * #108's git readout, which used to be a SECOND chip in the header answering
 * the same question this one does. Two indicators for one subject is what the
 * human filed, and folding the fault face in here is the answer — the reason a
 * repository will not take a write has to stay visible (that was #108's bug),
 * but it belongs on the control that is already talking about writes. Git's own
 * words ride it, on the tip AND on the `aria-label`, because a sentence only a
 * pointer can reach is a sentence half the readers never get.
 *
 * `unknown` is not a state of the DIRECTORY at all: it is this page, before the
 * server has said anything. It is here because the alternative is what the pill
 * used to do — draw the default value's `off` face, claiming a setting about a
 * server it had not heard from.
 *
 * `never` is not the same as `committed` and the difference is the whole reason
 * the last commit is carried at all: a clean tree that just committed and a
 * clean tree where olai has never written anything both have nothing pending,
 * and saying "committed" to the second would be a lie.
 */
export type Face =
  | "unknown"
  | "off"
  | "no-repo"
  | "error"
  | "blocked"
  | "waiting"
  | "committed"
  | "never"

/**
 * How much is waiting, in one place — and the fence every reader uses.
 *
 * It counts what the panel would DRAW: one per node-level change, one per other
 * dirty file, one per outline nothing could be read in, and one per outline
 * whose bytes moved with no node moving — a reformat, a reordered line. That
 * last term is why this is not simply `changes + others + unreadable`: such an
 * outline is dirty, committable and listed, and left out of the tally the pill
 * read `committed` while the panel underneath offered to commit it.
 *
 * Because it counts rows, `waitingIn(p) > 0` is exactly "the panel has
 * something in it" — so the count and the fence cannot disagree, which is the
 * shape the split into two numbers was reaching for and did not have.
 */
export const waitingIn = (pending: Pending): number => {
  const changed = new Set(pending.changes.map((change) => change.file))
  const unreadable = new Set(pending.unreadable)
  const silent = pending.outlines.filter((outline) =>
    !changed.has(outline.file) && !unreadable.has(outline.file)
  )
  return pending.changes.length + pending.others.length + pending.unreadable.length +
    silent.length
}

/**
 * The one face, from the two readings the server publishes together.
 *
 * `git` is the second argument rather than something derived from `pending`
 * alone, and it has to be: a repository whose identity nobody set answers
 * `rev-parse` perfectly happily, so `repo` reads `Ready` while every commit
 * fails — which is precisely the silence #108 was filed for. The server
 * REMEMBERS that refusal and publishes it as `error` (`@olai/ops`' `gitOf` and
 * the override beside it); nothing in the survey alone can say so. The two
 * values are recomputed from ONE survey in one statement (`server/runtime.ts`),
 * so reading both here is not a second probe.
 *
 * Order is the argument. A page that has heard nothing claims nothing. `off`
 * comes next because a server that never asks git cannot have a git fault to
 * report. Then the FAULT, ahead of `no-repo`: #108's rule is that broken-git
 * and no-repo must never collapse into each other, and of the two, the fault is
 * the one with something to fix.
 */
export const faceOf = (pending: Pending, heard: boolean, git: GitState): Face => {
  if (!heard) return "unknown"
  if (pending.repo._tag === "Off") return "off"
  // Both spellings of the same news: git could not be asked about the directory
  // at all (the survey's own answer), or it refused a commit here (the server's
  // memory, which no probe can see).
  if (git.status === "error" || pending.repo._tag === "Unusable") return "error"
  if (pending.repo._tag === "NoRepo") return "no-repo"
  const waiting = waitingIn(pending)
  // A busy repository with nothing waiting is not a problem anybody has: there
  // is nothing the block is stopping.
  if (waiting > 0) return pending.repo._tag === "Blocked" ? "blocked" : "waiting"
  return pending.last === null ? "never" : "committed"
}

/** Whether pressing it could do anything. The two settings are inert — there is
 *  no panel to open, because there is nothing behind it to say — and so is a
 *  page that has not been told anything yet.
 *
 *  `error` is deliberately NOT one of them. A git that refused a commit is a
 *  repository with writes waiting in it, and the panel is where they are listed
 *  and where the retry lives; and an inert control is a control a keyboard
 *  cannot reach, which is how the reason would go back to being hover-only. */
export const isInert = (face: Face): boolean =>
  face === "unknown" || face === "off" || face === "no-repo"

/**
 * Whether a phone should interrupt the page with this face.
 *
 * A healthy phone does not advertise health: `committed`, `never`, the two
 * settings, and a page that has not heard yet stay off screen. The desktop
 * pill is ALWAYS drawn, because absence and health look identical in a bar
 * of chips; a banner that is only there when there is news can be trusted
 * when it is absent, because the page itself is the healthy state.
 */
export const isNews = (
  face: Face,
  unpushed: number,
  /** Why the quiet-window loop stopped, or `null`. News on a phone for the same
   *  reason it is a chip on a laptop: the loop's whole promise is that nobody
   *  has to watch it, so the one moment it stops is the one moment it has to
   *  speak. */
  paused: string | null = null,
  /** ... and what git said when it last refused a push. On its own terms even
   *  where nothing is unpushed any more: a refusal that has been resolved by
   *  somebody else is cleared on the server, so a value here is a live one. */
  pushSaid: string | null = null,
): boolean =>
  face === "waiting" || face === "blocked" || face === "error" || unpushed > 0 ||
  paused !== null || pushSaid !== null

/**
 * One line for the phone banner. The panel behind it has the sentence.
 *
 * Waiting outranks unpushed when both are true: not-recorded is the more
 * urgent half of the same work, and the panel lists both.
 */
export const newsSays = (
  face: Face,
  waiting: number,
  unpushed: number,
  paused: string | null = null,
  /** Whether the last push was REFUSED — the one thing a growing unpushed count
   *  cannot say for itself, and the whole of `push-failure-invisible` on a
   *  phone. It outranks the plain count for the same reason the pause outranks
   *  a face: a number that is not coming down is a number with a reason. */
  pushSaid: string | null = null,
): string => {
  // A stopped loop outranks every face, because it is the one line that is
  // about something having gone wrong with a promise rather than about work.
  //
  // It KEEPS THE COUNT when there is one, and that is the whole of this arm
  // being three words longer than it was: a halted loop plus a later edit is
  // exactly when "how much is sitting here" is worth knowing, and a banner that
  // dropped it made a phone tap through to the panel to find out something the
  // desktop pill says beside the same chip.
  if (paused !== null) {
    return waiting > 0
      ? `${waiting} uncommitted · ${AUTO_PAUSED} — tap to see`
      : `${AUTO_PAUSED} — tap to see`
  }
  switch (face) {
    case "waiting":
      return `${waiting} uncommitted — tap to record`
    case "blocked":
      return `${waiting} uncommitted — repository busy`
    case "error":
      return "git error — tap to see"
    default:
      if (pushSaid !== null) return `${PUSH_REFUSED} — tap to see`
      return unpushed > 0 ? `${unpushed} unpushed — tap to push` : ""
  }
}

/**
 * The mark a face wears, or `null` for the faces that wear none.
 *
 * A table, so every face must be given one — including the ones whose answer is
 * NOTHING, which is a decision and is spelled out rather than left as a missing
 * key. It is here rather than in the component for the reason the retired
 * readout's `LOOK` was: what a state looks like is an argument about that state,
 * and an argument is a thing to unit-test.
 *
 * `⚠` is for the two a person can act on, in the two tones that tell them
 * apart: a repository mid-rebase is amber and will take a commit once they
 * finish, a git that failed is alarm and will not.
 *
 * The `✓` is deliberately NOT green, and that is #108's rule surviving its own
 * readout: the connection dot beside this pill is the page's one green claim,
 * and a second one permanently lit in the ordinary case dilutes the thing a
 * reader actually scans for. Recency is what the committed face carries
 * (`✓ committed · 3m ago`); the colour was only ever decoration.
 *
 * It is also not `text-muted`. Muted is a paper-page token, and this mark
 * lives on the ink header: muted-on-ink is the same colour as the bar, so
 * the tick vanished. Quiet here means the chip's own ink — no tone, so the
 * glyph inherits the pill and brightens with the words on hover.
 */
export interface Mark {
  /** One character, already in the font — nothing to load and nothing to
   *  disagree with the words beside it. */
  readonly glyph: string
  /** The token that paints it, when the glyph has a colour of its own.
   *  A theme token, never a literal colour. Absent is the chip's own ink. */
  readonly tone?: string
}

export const MARK: Readonly<Record<Face, Mark | null>> = {
  unknown: null,
  off: null,
  "no-repo": null,
  error: { glyph: "⚠", tone: "text-alarm" },
  blocked: { glyph: "⚠", tone: "text-doing" },
  waiting: null,
  committed: { glyph: "✓" },
  never: null,
}

/**
 * ... and the mark actually WORN, which a failing push overrules.
 *
 * `✓ committed · 13 unpushed` over a push that had been refused for an hour is
 * the screenshot this whole feature was filed against. The tick is a claim, and
 * it is a false one whenever the sharing half of the job is broken — so the
 * refusal takes the glyph, in alarm, whatever the face underneath is saying
 * about what is recorded.
 *
 * It is a RIDER rather than a ninth face, exactly as the unpushed count and the
 * pause are: a refused push says nothing about whether writes are being
 * recorded, which is what the faces are about, and folding it in would make
 * `4 uncommitted` and `push refused` compete for one word.
 */
export const markOf = (face: Face, git: GitState): Mark | null =>
  git.pushSaid === null ? MARK[face] : { glyph: "⚠", tone: "text-alarm" }

/**
 * What a face MEANS, in one sentence — the tip a pointer opens and the
 * `aria-label` everybody else gets.
 *
 * The static half. {@link explain} adds the words only the VALUE has, which is
 * the half #108 existed for: what git actually said.
 */
export const DETAIL: Readonly<Record<Face, string>> = {
  unknown: "waiting to hear from the server",
  off: "commits are off for this server (`--commit=off`), so nothing here is recorded",
  "no-repo":
    "this directory is not a git work tree, so writes land on disk but are not committed anywhere",
  // True of both ways this state is reached — a git that could not be asked
  // about the directory at all, and a commit it refused — because what happened
  // is in the words that follow, and what a reader needs first is the
  // consequence.
  error: "git failed here, so writes are landing on disk but are not being committed",
  // The two that are counted: {@link explain} puts the tally in front of them,
  // because "3 uncommitted" on screen and "some writes are waiting" in the
  // sentence would be the same fact told twice and told differently.
  blocked: "waiting to be committed",
  waiting: "waiting to be committed — open it to see what changed, and to record it",
  committed:
    "everything olai has written here is committed — open it for what it last recorded",
  never: "this directory is a git repository, and olai has not committed in it yet",
}

/**
 * The whole sentence, for the one face being worn.
 *
 * Three of the eight have something the table cannot hold: the fault carries
 * git's own words, and the two that are waiting carry how much. Everything else
 * reads as its own sentence.
 */
export const explain = (face: Face, pending: Pending, git: GitState): string =>
  alsoPaused(alsoUnpushed(sentence(face, pending, git), pending, git), git)

const sentence = (face: Face, pending: Pending, git: GitState): string => {
  switch (face) {
    case "error": {
      // The cell's words first — they are the remembered refusal, which is the
      // half a survey cannot see — and the survey's own as the fallback.
      const words = git.said === null || git.said === ""
        ? verbatim(pending.repo) ?? ""
        : git.said
      return words === "" ? DETAIL.error : `${DETAIL.error} — ${words}`
    }
    case "waiting":
      return `${counted(pending)} ${DETAIL.waiting}`
    case "blocked":
      return `${counted(pending)} ${DETAIL.blocked}, and ${because(pending.repo)}`
    default:
      return DETAIL[face]
  }
}

/**
 * ... and how much is recorded here and nowhere else, on whichever face is
 * being worn.
 *
 * It rides EVERY face rather than being one of them, because it is a different
 * question: what is not committed, and what is not shared. A clean tree with
 * eleven unpushed commits is the case that matters most and is the one no face
 * would have covered — `✓ committed` is true of it, and on its own it is the
 * complacent half of the truth.
 *
 * On the sentence as well as on the pill, because the sentence is what a reader
 * with no pointer gets: the pill's own `· 3 unpushed` is hover-free but silent
 * to a screen reader that only takes the label.
 */
const alsoUnpushed = (said: string, pending: Pending, git: GitState): string => {
  const unpushed = unpushedOf(pending)
  // WHY it is still unpushed, when git has said. This is the clause the
  // screenshot was missing: `✓ committed · 13 unpushed` is every word of it
  // true and the one that matters absent, because the refusal lived in a tab's
  // memory and that tab had been reloaded an hour before.
  if (git.pushSaid !== null) {
    const count = unpushed === null ? "" : `${unpushed} · `
    return `${said} · ${count}${PUSH_REFUSED}: ${git.pushSaid}`
  }
  return unpushed === null ? said : `${said} · ${unpushed}, and the panel can push them`
}

/** What a push that git said no to is CALLED — short, because it goes on a
 *  fixed-height bar and on a phone banner, with git's own words a gesture
 *  away. Spelled once for the chip, the sentence and the banner. */
export const PUSH_REFUSED = "the last push was refused"

/**
 * ── Auto-commit, as the DIRECTORY has it ──────────────────────────────
 *
 * The loop is the server's (`@olai/ops`' `loop.ts`); these are the words for
 * it. It is not one of the pill's {@link Face}s and never was: those are eight
 * things about whether writes are being RECORDED, and whether the loop has
 * stopped is a different question about the same directory — a stopped loop
 * with nothing waiting has nothing wrong with the history. It rides beside them
 * instead, exactly as the unpushed count does and for the same reason.
 *
 * What changed is who it is true of. These sentences used to describe THIS
 * BROWSER — a loop in this tab, a pause a reload cleared — so two tabs could
 * say different things about one directory and a phone could say a third. They
 * are read off the git cell now, so every reader gets the same one.
 */

/** The chip a stopped loop wears in the header. Short, because the bar is a
 *  fixed height and the sentence is one gesture away — on the tip, on the
 *  `aria-label`, and in full in the panel. */
export const AUTO_PAUSED = "auto-commit paused"

/**
 * WHAT THE LOOP IS DOING, as one word — and the one place that reading is made.
 *
 * Three states, and they are the DIRECTORY's: `off` where the policy is not the
 * quiet window, `paused` where git stopped it, `armed` otherwise. Three
 * surfaces ask — the pill wears it as `data-auto`, the panel makes a promise
 * off it, and a phone's banner speaks it — and asked separately they would be
 * three readings of one cell, free to disagree about a directory that has none
 * of the ambiguity between them.
 */
export const loopIn = (git: GitState): "off" | "armed" | "paused" =>
  git.policy.commit !== "auto" ? "off" : git.paused !== null ? "paused" : "armed"

/**
 * The one gesture that starts the loop again, spelled once for both sentences
 * below: the header and the panel drifting on how to restart it is the one
 * sentence a reader cannot work out for themselves.
 *
 * ONE gesture now, where there were two. The stop used to be this tab's, so
 * turning the browser's own Auto-commit toggle off and on again cleared it —
 * and on a server that had PINNED the policy there was no toggle to flip, so
 * the frozen row grew a Resume button and the sentence had to name whichever
 * one this reader had. The stop is the directory's, so neither a toggle nor a
 * reload can clear it: Resume is the gesture, on every deployment.
 */
const RESUME_GESTURE = "Press Resume in preferences to start it again."

/**
 * ... and the sentence the HEADER carries, which is git's own words plus that
 * gesture.
 *
 * The gesture is named because a stopped loop is silent by design: without a
 * sentence saying how to start it again, "olai stopped committing" is something
 * a person finds out days later from `git log`.
 *
 * The WORDS are in it because the header has nowhere else to put them: this is
 * the pill's tip and its `aria-label`, and a reader with no pointer would
 * otherwise be told a loop stopped and never told why. The PANEL is the other
 * case and takes {@link AUTO_STOPPED} instead — git's refusal is already a line
 * of its own down there, beside the verb that produced it, and one paragraph
 * printed twice in one popover is a popover nobody reads either copy of.
 */
const autoSays = (paused: string): string =>
  `auto-commit is paused — ${paused}. ${RESUME_GESTURE}`

/** ... and the same clause for a sentence that has ALREADY quoted whatever git
 *  said, which is the ordinary case: a refused push both stops the loop and
 *  rides {@link alsoUnpushed}, so a paragraph of git's hints would otherwise be
 *  printed twice inside one `aria-label`. */
const AUTO_SAYS_AGAIN = `auto-commit is paused. ${RESUME_GESTURE}`

/** Whether the words that stopped the loop are already on the sentence. There
 *  are exactly two things that can have printed them — the refused push's
 *  clause and the fault face's — and the stop is set from one of those two, so
 *  this is a comparison rather than a search through the prose. */
const quoted = (git: GitState): boolean =>
  git.paused === git.pushSaid || git.paused === git.said

/** ... and the PANEL's line, which does not repeat git — see {@link autoSays}. */
export const AUTO_STOPPED =
  `auto-commit is paused, and what git said is below. ${RESUME_GESTURE}`

/** What an ARMED loop is about to do with what the panel is listing. Drawn only
 *  while it is really going to happen, so it is a promise rather than a
 *  description of a setting. */
export const AUTO_ARMED =
  "Auto-commit will record all of this as one commit once the edits stop."

/**
 * The pause, on whatever sentence the face produced — see {@link explain}.
 *
 * GIT'S WORDS GO IN ONCE. The same refusal is very often already on the
 * sentence: a push that would not go stops the loop AND rides the unpushed
 * clause, so quoting it here as well put the whole of git's non-fast-forward
 * hint — five lines of it — twice into one label, which is a label nobody reads
 * either copy of.
 */
const alsoPaused = (said: string, git: GitState): string =>
  git.paused === null
    ? said
    : `${said} · ${quoted(git) ? AUTO_SAYS_AGAIN : autoSays(git.paused)}`

/** How much is waiting, in words — the same tally the pill draws as a number,
 *  so the sentence and the label cannot disagree. */
const counted = (pending: Pending): string => {
  const waiting = waitingIn(pending)
  return `${waiting} ${waiting === 1 ? "change is" : "changes are"}`
}

/**
 * What happened to a file that is not an outline — the chip beside its path.
 *
 * Git's own word for each, because these rows are the one place the panel
 * reports on a file rather than on a node, and a person who is going to reach
 * for a terminal about one of them should read the same word `git status` uses.
 */
export const HOW: Readonly<Record<How, string>> = {
  modified: "modified",
  added: "added",
  deleted: "deleted",
  renamed: "renamed",
  untracked: "untracked",
}

/**
 * The tone each chip wears, out of the palette the marks already use.
 *
 * Three tones for five words, and the grouping is what a reader is being told:
 * a file that has LEFT is the one worth a second look (`alarm`), a file that is
 * NEW to the repository is a claim about the tree rather than an edit to it
 * (`done` — the same green a finished node wears, because arriving is the
 * ordinary good case), and everything else is an edit (`doing`'s amber, the tone
 * of work in progress). Nothing here is red-for-danger: every one of these is a
 * file somebody is about to record on purpose.
 */
export const HOW_TONE: Readonly<Record<How, string>> = {
  modified: "text-doing",
  added: "text-done",
  untracked: "text-done",
  renamed: "text-doing",
  deleted: "text-alarm",
}

/**
 * What the panel is reporting ON — the scope line, which is new because the
 * scope changed.
 *
 * It used to be unsayable and unnecessary: what was waiting was the served
 * outlines, and the panel hung off a page already showing them. Now it is every
 * dirty file in the repository, so a `README.md` two directories above the
 * outlines is a row in this list — and a reader who is not told that has to
 * work out why.
 */
/**
 * Where a renamed row came FROM, in the spelling the OUTLINE list draws its own
 * names in.
 *
 * The wire carries `from` repo-root-relative on both kinds of row — the one
 * unambiguous name a file has across a repository, and the namespace a commit
 * request ticks in. The other-files list draws that name as it is; the outline
 * list draws SERVED names (`roadmap.olai`, not `docs/roadmap.olai`), and
 * `docs/a.olai → b.olai` on one line is two spellings of the same directory in
 * six inches of screen.
 *
 * A file from OUTSIDE the served root keeps its repo-relative name, which is
 * the only honest thing to call it: it really is up there, and shortening it
 * would name a file that does not exist.
 */
export const localOf = (from: string | null, served: string): string | null =>
  from !== null && served !== "" && from.startsWith(served)
    ? from.slice(served.length)
    : from

export const scopeOf = (served: string): string =>
  served === ""
    ? "whole repository · olai serves it from the root"
    : `whole repository · olai serves ${served}`

/**
 * What is committed here and nowhere else, in the sentence the panel puts beside
 * the Push button — and the header puts in its own words.
 *
 * `null` for a branch with no upstream and for one already in sync: there is
 * nothing to offer, and a button that pushed nothing would be a button that
 * teaches a person to ignore it.
 */
export const unpushedOf = (pending: Pending): string | null => {
  const unpushed = pending.unpushed
  if (unpushed === null || unpushed.commits === 0) return null
  const commits = `${unpushed.commits} ${unpushed.commits === 1 ? "commit" : "commits"}`
  return `${commits} not on ${unpushed.upstream}`
}

/**
 * What git said when it last refused a push, or `null` when the last one
 * worked.
 *
 * ONE FIELD READ, and that is the whole of what this function is left as: it
 * used to unpack a five-armed value this TAB held about its own last press,
 * cleared on the next one and lost on a reload. Now the refusal is remembered
 * by the server and published to every tab, and the server clears it the moment
 * there is nothing unshared — including when somebody resolved it in a
 * terminal, which the tab-local version could never have noticed.
 *
 * The words are git's own, whole, because they are what a person is about to
 * paste into a terminal: authentication, a non-fast-forward, a branch with no
 * upstream.
 */
export const pushRefused = (git: GitState): string | null => git.pushSaid

/** Who a writer is, to a reader. `web` is the only one that gets a different
 *  word than its name: the person reading this is the one who pressed the
 *  button, and "web" would be telling them about a transport.
 *
 *  Keyed by `Writer` rather than by `string`, so a writer the format grows is
 *  a compile error here instead of a raw tag on screen. */
export const WHO: Readonly<Record<Writer, string>> = {
  "chat-agent": "chat agent",
  mcp: "an agent in a terminal",
  web: "you",
  // The server's own quiet window, which nobody pressed. `auto-commit` rather
  // than "the server": a reader who turned the row on recognises the name of
  // the thing they turned on, and a commit trailer saying `web` here would have
  // told them they made it.
  auto: "auto-commit",
  // Also you, and deliberately not said that way: the write came in at
  // `POST /capture` from a share sheet, a script or another machine on the
  // tailnet, and a reader looking at a change they do not remember making is
  // owed the door rather than the reassurance.
  capture: "a quick capture",
}

/** Why the repository cannot take a commit right now. Git's own words ride the
 *  pending value as `said` and are what the panel hangs on the line as a title;
 *  this is the sentence. */
export const because = (repo: RepoState): string => {
  switch (repo._tag) {
    case "Blocked":
      return BLOCKED[repo.reason]
    // A git that could not be asked at all. It says so HERE as well as on the
    // pill, because this is the line the panel draws where the button would be
    // — and "there is nowhere to commit to" would be reporting a broken git as
    // an absent repository, which is the one confusion #108 exists to have
    // ended.
    case "Unusable":
      return "git could not be asked about this directory"
    // The two settings, and the pill DOES draw for both — it is never absent —
    // but their sentence is {@link DETAIL}'s, because they are statements
    // rather than something to fix. This is the fallback that keeps the
    // function total.
    default:
      return "there is nowhere to commit to"
  }
}

/** Git's own words, when there are any — what you would paste into a search,
 *  which is why they are kept verbatim rather than folded into the sentence
 *  above. Both states that HAVE any hand them over: a repository that is busy,
 *  and a git that failed. */
export const verbatim = (repo: RepoState): string | undefined =>
  repo._tag === "Blocked" || repo._tag === "Unusable" ? repo.said : undefined

const BLOCKED: Readonly<Record<Reason, string>> = {
  merge: "a merge is in progress — finish it first",
  rebase: "a rebase is in progress — finish it first",
  "cherry-pick": "a cherry-pick is in progress — finish it first",
  detached: "HEAD is detached — check out a branch first",
}

/**
 * What git said when it last refused a COMMIT, or `null` when it did not.
 *
 * The cell's `said`, read only on the face that has one — a `Blocked`
 * repository puts its own words on `pending.repo` and the panel draws those
 * beside the button, and quoting them here as well would be one paragraph
 * printed twice in one popover.
 *
 * It used to be this TAB's last attempt, unpacked from five arms, which had the
 * shape of a receipt and the lifetime of a page: the commit an agent made, the
 * one the quiet window made, and the one made in another tab all left nothing
 * here. What is drawn now is the directory's, so a reload does not change it and
 * the reader who opens the panel last sees what the reader who opened it first
 * saw.
 */
export const commitRefused = (git: GitState): string | null =>
  git.status === "error" ? git.said : null
