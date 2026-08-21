/**
 * The input row: type, send, cancel.
 *
 * Three behaviours, and each of them is here because the panel is unusable
 * without it:
 *
 *   - **Enter sends, Shift+Enter is a newline.** A prompt is usually one line
 *     and occasionally several, and the common case should not need a button.
 *   - **Cancel appears BESIDE send while a turn is running**, rather than
 *     replacing it. Replacing it was right while a mid-turn send was refused:
 *     there was one action available and one place to look for it. Now that a
 *     mid-turn message STEERS the running turn, sending and stopping are two
 *     things a person can genuinely want at the same moment — and they want
 *     opposite things, which is exactly why both have to be on screen. The
 *     button says `send` throughout: it used to say `queue` while a turn ran,
 *     back when the panel really did hold the message.
 *   - **a question the agent asked is said HERE too**, not only where the form
 *     is. Nothing times out a blocked turn, so a form that has scrolled out of
 *     sight looks exactly like an agent that is thinking — and this row is
 *     where a person's attention already is, because it is where they were
 *     about to type.
 *   - **a file can be pasted, dropped, or picked.** Three events, one path:
 *     `attach` sends the bytes to the conversation's tmp directory and answers
 *     with a path, which rides the next `send`. All three ship together
 *     because they are the same function behind different listeners — paste is
 *     the desktop gesture, drop is the one for a file already on screen, and
 *     the picker is the only one a phone has, since a phone has no Ctrl+V.
 *     Attaching does NOT send: the file sits in a strip above the box, where
 *     it can be removed or typed at, because "what is wrong here" needs the
 *     file and the question together. Two of those three listen HERE; the drop
 *     is caught by the panel around this row ({@link ./DropTarget.tsx}),
 *     because a file dragged at a conversation is aimed at the conversation.
 *     What all three land in is one owner above both ({@link ./holding.ts}).
 *
 *     All three take the same kinds, and the picker's `accept` is spelled from
 *     the gate's own list to keep that true: a dialog that greys out a PDF the
 *     drop would have taken is the one half-truth a person meets without any
 *     refusal to explain it.
 *   - **a message can be ABOUT a node**, and there are two doors onto that.
 *     "Ask agent" on a row arms this box with that node ({@link ./armed.ts}),
 *     and it sits in a chip above the input until it is sent or taken off — the
 *     attachment strip's arrangement, because it is the attachment strip's
 *     claim: this went with the message. Typing `@` and taking a node row is
 *     the other, and it adds the WORD to the sentence as well as the chip
 *     (below). What is armed either way is an ID; what the chip reads is the
 *     title, out of the live set; what rides the send is the id again, and the
 *     SERVER says what the node is. So a row armed, renamed and then sent
 *     reaches the agent under the name it has now, and a row armed and then
 *     DELETED refuses the send rather than sending a question with no subject.
 *   - **`/` opens the agent's own commands**, and so does the button beside
 *     the input, which shows the WHOLE list. Typing filters; the button is for
 *     when you do not know what to type, which is most of the time you want a
 *     command list at all. It is drawn only when there are commands — a button
 *     that opens nothing is a button that lies. The list comes from the agent
 *     (the `commands` frame), so it is whatever that agent actually offers
 *     rather than a list olai maintains. Accepting one only writes `/name ` —
 *     sending is what invokes it, exactly as typing it would.
 *   - **`@` opens what the directory holds under that word** — its files and
 *     its nodes, in one list of eight ({@link ./naming.ts}) — and taking a row
 *     writes `@the/path ` or `@the-id ` into the sentence. It is the same
 *     gesture as the slash list and draws the same box
 *     ({@link ./CompletionMenu.tsx}); what differs is where the rows come from
 *     (the key sets this tab already holds, and — since `search-server-side` —
 *     the server's own search for the nodes) and that the span it replaces is a
 *     WORD inside the message rather than the whole line
 *     ({@link ./completion.ts}).
 *
 *     What it writes is TEXT, and deliberately not an attachment. The `+`
 *     button's files are copies in a temp directory that the agent is handed
 *     the path of (`@olai/chat`'s attachments) — the right arrangement for a
 *     screenshot on the clipboard, which is nowhere until something puts it
 *     somewhere, and the wrong one for a file that is already in the directory
 *     the agent is working in: a copy stops being true the moment anything
 *     writes, and this one would be a copy of a file the agent can read where
 *     it lives. So the path rides the message as the word it is, and the
 *     conversation reads the way it was typed.
 *
 *     A NODE'S WORD IS ITS ID, and taking one arms the node beside writing it.
 *     The two halves carry different facts and neither is a copy of the other:
 *     the word says WHERE in the sentence the node is meant — `compare @a with
 *     @b` is unsayable by two chips — and the arming is what makes the id
 *     resolvable, since the server answers it against the live set and puts the
 *     title, the `file:line` and the ancestors under the message. A title
 *     written into the sentence instead would be a copy that goes stale, and
 *     one with no end inside a sentence: titles are prose and are not unique.
 *
 *     THE WORDS ARE THE LAST WORD. What this message is about is the nodes
 *     taken off the list that the draft STILL NAMES ({@link namedIn}), so
 *     deleting the word takes the chip with it, and nothing has to remember a
 *     disarm. The one thing that is not read back is the `•••` menu's arming:
 *     that gesture put a node there INSTEAD of a sentence, so there are no
 *     words for it to be contradicted by.
 *
 * The draft is local to this tab and is deliberately NOT a surface member: it
 * is an editor, not committed state, and two tabs typing at once should not
 * fight over one box.
 */

import { ATTACHMENT_EXTENSIONS } from "@olai/surface"
import { batch, createEffect, createMemo, createSignal, on, Show } from "solid-js"

import type { Written } from "../complete/trigger.ts"
import { createChipTitles } from "./chips.ts"
import { SaidLine } from "../SaidLine.tsx"
import { sameIds } from "../ids.ts"
import { createSearch } from "../search/nodes.ts"
import { atOnce } from "../settled.ts"
import { useServed } from "../served.tsx"
import { TESTID } from "../testids.ts"
import { armedNodes, disarmNode, releaseArmed, restoreArmed } from "./armed.ts"
import { Attachments } from "./Attachments.tsx"
import {
  type Completing,
  completed,
  completingIn,
  namedIn,
  tokenOf,
  unnamed,
} from "./completion.ts"
import { CompletionMenu, type MenuRow } from "./CompletionMenu.tsx"
import { type Chip, ContextChips } from "./ContextChips.tsx"
import type { Holding } from "./holding.ts"
import { offers } from "./naming.ts"
import type { Chat } from "./state.ts"

/** Every control on the toolbar, the same height and the same corners. Written
 *  once because "these line up" is the property, and three copies of a class
 *  list line up only until somebody edits one. */
const CONTROL =
  "flex h-8 shrink-0 items-center justify-center rounded border text-xs"

export function Composer(props: {
  readonly chat: Chat
  /** The files attached and not yet sent. Made by the panel, because the
   *  panel is where a drop is caught and this row is where the chips go. */
  readonly holding: Holding
}) {
  const [draft, setDraft] = createSignal("")
  /**
   * WHERE THE CARET IS, which is the one fact a draft does not carry and the
   * `@` list cannot be armed without: what is being completed is a word inside
   * the message rather than the whole of it.
   *
   * Read off the element rather than tracked alongside it, for
   * `../edit/RowEditor.tsx`'s reason — the caret moves for reasons no handler
   * here sees (a click in the middle of a sentence, `Home`, a drag-selection,
   * an IME), so every event that could have moved it re-reads it and the value
   * is the element's own answer rather than this component's arithmetic about
   * what the last key should have done.
   */
  const [caret, setCaret] = createSignal(0)
  /** The one piece of MEMORY in the completion, and it remembers a token
   *  rather than a mood: Escape over one `@` keeps that one shut while it is
   *  being typed, and starting another `@` — or moving the caret to one — is a
   *  fresh offer (`./completion.ts`'s `tokenOf`). Without it, Escape could
   *  only mean "throw the sentence away", which is the wrong of the two
   *  answers to a key pressed to make a popup go away. */
  const [dismissed, setDismissed] = createSignal<string | null>(null)
  /** Opened by the BUTTON rather than by typing a slash — the difference is
   *  only which prefix the list is filtered by. */
  const [asked, setAsked] = createSignal(false)
  /**
   * The nodes TAKEN off the `@` list, which is not the same as the nodes this
   * message is about: what it is about is these, minus the ones whose word is
   * no longer in the draft ({@link namedIn}). A person who deletes `@hinges`
   * has said the message is not about that node — and a chip that outlived its
   * word would send a subject the sentence never mentions.
   *
   * A SET rather than a list, because order is the draft's: `compare @a with
   * @b` says which is which, and this remembers only which rows were chosen.
   *
   * This composer's, like the draft it is read against — where the strip the
   * `•••` menu fills is the app's (`./armed.ts`), because that gesture happens
   * in a pane on the other side of the screen and belongs to no box.
   */
  const [taken, setTaken] = createSignal<ReadonlySet<string>>(new Set())
  let input: HTMLTextAreaElement | undefined
  let picker: HTMLInputElement | undefined

  const readCaret = (): void => {
    setCaret(input?.selectionStart ?? 0)
  }

  const working = () => props.chat.state().status === "thinking"



  /**
   * WHICH NODES THIS MESSAGE IS ABOUT, from the two doors onto one strip.
   *
   * The `•••` menu's, which are the app's and are held until they are taken off
   * or sent — that gesture put the node there instead of a sentence, so there
   * are no words for it to be contradicted by. Then the ones taken off this
   * box's own `@` list, in the order the DRAFT names them, which is where the
   * words are the last word ({@link namedIn}).
   *
   * Deduped with the armed door winning its place: a node armed from a row and
   * then also named in the sentence is one node, and one chip.
   */
  const subjects = createMemo<ReadonlyArray<string>, undefined>(
    // A `Set` keeps insertion order and the FIRST occurrence wins, which is the
    // dedupe rule stated above without a filter to spell it (`../edges/named.ts`
    // leans on the same guarantee).
    () => [...new Set([...armedNodes(), ...namedIn(draft(), taken())])],
    undefined,
    // BY VALUE, because this list is a QUESTION and not a rendering: what reads
    // it asks the server what these ids are called ({@link ./chips.ts}), and
    // what feeds it is the DRAFT — so every keystroke of a sentence with one
    // chip armed mints an array that is a new object and the same set, and a
    // typed word costs a wire call per letter. The chip's own rule says the
    // question goes when the ARMING moves; this is what makes that true.
    { equals: sameIds },
  )

  /** ...as chips: the id is what was armed and what will be sent, and the TITLE
   *  is asked of the server — through the format's own rule for what an id
   *  names, the one `see` links resolve with, run where the set is
   *  ({@link ./chips.ts}). Nothing about the chip is a copy of anything the
   *  page holds. An id the set does not declare reads as the id, which is what
   *  a dangling `see` does and for the same reason: the strip says what is
   *  armed rather than going blank about it. */
  const titles = createChipTitles(subjects)
  const armed = createMemo<ReadonlyArray<Chip>>(() =>
    subjects().map((id) => ({ id, title: titles().get(id) ?? id }))
  )

  /**
   * WHAT THE BOX HAS ARMED — a command, a file, or nothing ({@link
   * ./completion.ts}, which is where every rule about the two lives and where
   * the tests for them are).
   *
   * NOTHING HERE IS STATE: what is armed is a function of the draft and the
   * caret, so backspacing over the `@` shuts the list and typing it again
   * opens the same one. That is what makes the whole thing restartable from
   * any keystroke, including the ones that arrive while a turn is running.
   */
  const trigger = createMemo<Completing | null>(() => completingIn(draft(), caret()))

  /** ...and what is OFFERED, which is that minus a dismissal and plus the
   *  button: the button asks for the whole command list whatever the line
   *  says, which is the point of it. Two memos rather than one because the
   *  effect below needs the answer BEFORE the dismissal is applied — a rule
   *  that read the dismissed value would clear its own reason. */
  const found = createMemo<Completing | null>(() => {
    const now = trigger()
    if (asked()) {
      return now?.kind === "command" ? now : { kind: "command", from: 0, query: "" }
    }
    return now === null || tokenOf(now) === dismissed() ? null : now
  })

  // A DISMISSAL LASTS AS LONG AS THE THING IT WAS ABOUT. Escape shuts the list
  // over the word being typed and keeps it shut while that word goes on being
  // typed — but the moment nothing is armed at all (a space typed, the `@`
  // backspaced away, the caret moved out of the word) the memory goes with it.
  // Without this the token is only the KIND and the OFFSET, so a second `@`
  // typed where the first one was would come up already dismissed — a list
  // that never returns for the rest of the message, for a key pressed about
  // one word.
  createEffect(() => {
    if (trigger() === null) setDismissed(null)
  })

  /** The served directory's paths — the two key sets this tab already holds
   *  (`../served.tsx`), so there is no walk and no request behind the FILE half
   *  of an `@`. They are folded for matching by `../file/matching.ts`, which
   *  keeps its answer against the list it was given: asked only while a name is
   *  being typed, and done once per version of the directory rather than once
   *  per keystroke. */
  const files = useServed()

  /** ...and the word an `@` is looking for, or `null` when the box is not
   *  naming anything — a `/` command, a dismissed list, nothing typed. */
  const naming = createMemo(() => {
    const completing = found()
    return completing !== null && completing.kind === "name" ? completing.query : null
  })

  /**
   * THE NODE HALF, asked of the server — the same procedure the ⌘K palette, the
   * header box, the `((` widget and the edge panel call, with the same debounce
   * and the same rule about a stale answer (`../search/nodes.ts`). It used to
   * be a walk over the set this tab held, which is the copy
   * docs/brainstorming/vault-in-browser.md is taking away.
   *
   * `"node"` because this list writes an id into a sentence and arms it: a
   * document has no id to write, so the narrowing rides the REQUEST rather than
   * being filtered out of the answer — a door that filtered afterwards runs
   * short exactly when a query matches enough documents to fill the cap.
   *
   * OUTSIDE the rows memo, deliberately: a resource created inside a memo would
   * be a new resource per keystroke, which is the debounce undone.
   */
  const nodesNamed = createSearch(naming, "node")

  /** A SWITCH rather than a chain of `if`s whose last arm is a fall-through:
   *  the two kinds and the two lists are one table the compiler checks, so a
   *  third trigger could not quietly render commands. */
  const rows = createMemo<ReadonlyArray<MenuRow>>(() => {
    const completing = found()
    if (completing === null) return []
    switch (completing.kind) {
      case "command":
        return props.chat
          .state()
          .commands.filter((command) => command.name.startsWith(completing.query))
          .map((command) => ({
            value: command.name,
            label: `/${command.name}`,
            hint: command.description,
            // The AGENT'S own list, off the chat cell this tab already holds —
            // no answer behind it to be inside the settle of
            // (`../settled.ts`).
            taking: atOnce,
            take: () => accept(command.name),
          }))
      case "name":
        // WHAT THE DIRECTORY HOLDS UNDER THAT WORD — the files and the nodes,
        // in one list of eight, which is `./naming.ts`'s rule and its argument.
        // The paths are the key sets this tab holds, matched here; the nodes are
        // the server's answer to the same word, which arrives a beat later and
        // takes the slack the file half was not using.
        return offers(files(), nodesNamed.hits(), completing.query).map((offer) => ({
          value: offer.value,
          label: offer.label,
          hint: offer.hint,
          section: offer.section,
          // WHICH ANSWER THE ROW CAME FROM, carried on the row so a KEY cannot
          // spend one of a word the reader has typed past
          // ({@link ./CompletionMenu.tsx}'s `MenuRow.taking`). A NODE row is
          // the server's and holds still through the settle and the flight; a
          // FILE row is matched in this tab, per keystroke, off a list it
          // already holds, so nothing is ever behind it.
          taking: offer.kind === "node" ? nodesNamed.taking : atOnce,
          // The draft and the caret are read when the row is TAKEN, not when
          // it was drawn — and what replaces the span is `./completion.ts`'s,
          // including the rule about not writing a second space into somebody
          // else's sentence.
          take: () => {
            // A NODE IS ARMED AS WELL AS WRITTEN, and the two halves say
            // different things: the word says WHERE in the sentence this node
            // is meant, and the arming is what makes the id resolvable — the
            // server answers it against the set the write would be judged
            // against, and the agent gets the title, the `file:line` and the
            // ancestors under the message (`@olai/chat`'s `lineFor`). Neither
            // half is a copy of the other's fact.
            if (offer.kind === "node") {
              setTaken((already) => new Set(already).add(offer.value))
            }
            rewrite(completed(draft(), completing, offer.value, caret()))
          },
        }))
    }
  })

  const open = () => rows().length > 0

  // SOMETHING LANDED IN THE STRIP, so the caret comes here — a file let go of
  // anywhere on the panel, or a node armed from a row somewhere in the tree.
  // Both are the same gesture from this row's point of view: it never hears
  // about the drop or the menu, only about what they left behind, and the next
  // thing to do with either is ask about it. One effect over the whole strip,
  // because "the caret goes to the box" is one rule and two of them would be
  // two chances to focus twice on a drop that also armed something.
  createEffect(
    on(
      () => props.holding.pending().length + armedNodes().length,
      (now, before) => {
        if (before !== undefined && now > before) input?.focus()
      },
    ),
  )

  /**
   * Send, and PUT IT BACK if the server would not take it.
   *
   * The box is cleared immediately, because it has to be: a send that waited
   * for a round trip before emptying the box would send twice for two quick
   * presses of Enter. But the clear was also the end of the story, and a
   * refusal — a file whose conversation was left while it uploaded, most of
   * all — left the message and the chips gone and only a red line to say why.
   * Chips are worse than words that way: they stand for round trips somebody
   * already waited through.
   *
   * Only put back into a box that is still empty. If the answer comes back
   * while a person is already typing the next thing, what they are typing wins.
   */
  const send = async () => {
    const text = draft()
    if (
      text.trim() === "" &&
      props.holding.pending().length === 0 &&
      // What the message is ABOUT, which is what rides the send — not the app
      // strip alone, now that half of it is read off the words. Equivalent
      // today, since an empty draft names nothing; the point is that it says
      // the thing the guard means.
      subjects().length === 0
    ) return
    const attachments = props.holding.release()
    // WHAT THE MESSAGE IS ABOUT, read once — before the box is cleared, since
    // half of it is read off the words that are about to go.
    const context = subjects()
    // Released with the attachments and put back with them: an armed node is
    // part of the message in exactly the way a picture is, and a refusal that
    // restored one and not the other would leave a message that is not the one
    // that was refused.
    const held = releaseArmed()
    const chosen = taken()
    setTaken(new Set<string>())
    setDraft("")
    // The caret goes with the words: an empty box's caret is at its start, and
    // a stale offset would arm the next `@` against the sentence just sent.
    setCaret(0)
    setAsked(false)
    setDismissed(null)
    // Where the caret already is, unless something took it — a person sending
    // two messages in a row should not have to aim at the box for the second.
    input?.focus()

    const sent = await props.chat.send(
      text,
      attachments.map((attachment) => attachment.path),
      context,
    )
    if (sent) return
    // THE WORDS AND THE PERMISSION FOR THEM MOVE TOGETHER, on one test rather
    // than two: the restored `@hinges` has to be a word the panel remembers
    // writing, or the message goes the second time without the subject it was
    // refused with. Two separately-evaluated "is it still empty?" guards could
    // answer differently — somebody typing while the refusal is in flight keeps
    // their words and would have got the old permissions back underneath them.
    if (draft() === "") {
      setDraft(text)
      setTaken(chosen)
    }
    props.holding.restore(attachments)
    restoreArmed(held)
  }

  /** A command taken: `/name ` and nothing else — sending is what invokes it,
   *  exactly as typing it would. The whole LINE is replaced because a command
   *  is the whole line (`./completion.ts`). */
  const accept = (name: string) => {
    rewrite({ text: `/${name} `, caret: name.length + 2 })
    setAsked(false)
  }

  /**
   * Put `next` in the box, caret and all — the DOM half of taking a row.
   *
   * The ELEMENT first and the signal last, which is `../edit/RowEditor.tsx`'s
   * order and load-bearing for the same reason: setting a field's `value`
   * moves the caret to the end of it, so the selection has to be set after the
   * value is there rather than before.
   *
   * WHAT THAT LEAVES is one thing this file cannot prove on its own: Solid's
   * `value` binding runs after these lines, and it holds its own copy of what
   * it last wrote — so it skips the assignment when the string has not changed
   * from ITS point of view, which after `setDraft` it has not. That is a
   * framework behaviour, not a platform guarantee: the HTML spec says setting
   * `value` to the same string leaves the selection alone, and engines have
   * not always agreed. Neither claim is one to rest a caret on by reading, so
   * the caret is asserted where it can be — in a browser, after a completion
   * taken mid-sentence (`features/chat_at_completion.feature`, which reads
   * `selectionStart` back rather than believing this paragraph).
   *
   * IT TAKES THE CARET BACK, which matters for the row that was CLICKED: the
   * press moved focus to the button, and the button is gone a moment later
   * because taking a row is what ends the trigger. Without this, completing
   * with the mouse would leave the sentence half-typed and nothing focused —
   * the one gesture where a completion costs a click instead of saving one.
   *
   * AND IT COSTS THE UNDO, which is worth knowing here because two comments and
   * a paragraph of docs/chat.md used to claim otherwise (found by review,
   * d17ec4f6, and then checked in a browser rather than argued): assigning
   * `value` is a write the box did not receive as input, so the engine's own
   * undo history for it is dropped and ⌘Z has nothing to take back. The
   * alternative is `execCommand("insertText")` — deprecated, and it would put
   * the composer's one text edit on a path nothing else in this client uses to
   * buy back a keystroke that has another answer: delete the word, which is
   * what the chip is read from anyway.
   */
  const rewrite = (next: Written) => {
    if (input !== undefined) {
      input.value = next.text
      input.setSelectionRange(next.caret, next.caret)
      input.focus()
    }
    // Batched for the reason the box's own `onInput` is: the two signals the
    // list is a function of are being moved together, and two writes would ask
    // the directory and the set the same question twice.
    batch(() => {
      setDraft(next.text)
      setCaret(next.caret)
    })
  }

  /**
   * The `×` on a chip: this message is not about that node.
   *
   * ONE PRESS, BOTH DOORS, because a reader pressing it is saying one thing and
   * does not know which door the chip came through: the app's strip gives the
   * node up (`./armed.ts`, a no-op for a node that was never on it), and the
   * WORD comes out of the sentence — every `@id` that names it, since a message
   * that says it twice means it once.
   *
   * Taking the word out is the whole reason this is not just a `disarmNode`:
   * the words are what the strip is read from, so a chip removed while its word
   * stayed would come straight back, and a message that went with the word in
   * it would name a node it had just been told it was not about. The `×` is the
   * only thing in the panel that edits somebody's draft, and it edits it to
   * agree with what they pressed.
   *
   * ...and it is the ONLY edit: what was taken stays taken. A second lever here
   * — dropping the id out of {@link taken} as well — would make this press mean
   * something a keyboard delete does not, and the difference would show up at
   * word: an `×` that also revoked the take would mean something a keyboard
   * delete does not, and the take is what makes retyping the word bring the
   * node back. One rule, one lever, and the word decides.
   */
  const unname = (id: string) => {
    disarmNode(id)
    const next = unnamed(draft(), id, caret())
    if (next.text !== draft()) rewrite(next)
  }

  /** Escape: the LIST goes and the sentence stays. What is remembered is the
   *  token it was over, so typing on in the same word does not bring it back
   *  and the next Enter is the send it was meant to be. */
  const dismiss = () => {
    const completing = found()
    if (completing !== null) setDismissed(tokenOf(completing))
    setAsked(false)
  }

  /** The button: the whole list, or put it away if it is already up. */
  const askForAll = () => {
    if (open()) {
      dismiss()
      return
    }
    setDismissed(null)
    setAsked(true)
    input?.focus()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // NOTHING ON SCREEN TAKES NOTHING (`../complete/completing.tsx`'s rule,
      // kept). A visible list answers Escape itself, in the capture phase, so
      // reaching HERE means there was no list to put away — and remembering a
      // dismissal for one nobody saw would shut the next one silently. What is
      // left to do is drop the BUTTON's ask, which is a state this row owns and
      // can be true with an empty list under it.
      setAsked(false)
      return
    }
    // Enter sends. It does NOT need a "unless the menu is open" guard: the menu
    // takes the key in the capture phase and stops it propagating, so this
    // handler does not run while it is up (see ./CompletionMenu.tsx). One
    // mechanism for one rule — a second one here would be a guard nobody could
    // test.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
    // AFTER the send, so a key that moved the caret has moved it:
    // `queueMicrotask` is one turn later, which is when the field's selection
    // reflects the press (`../edit/RowEditor.tsx` does the same, for the same
    // widgets' sake).
    queueMicrotask(readCaret)
  }

  return (
    <div class="relative shrink-0 p-2">
      <Show when={open()}>
        <CompletionMenu
          kind={found()?.kind ?? "command"}
          rows={rows()}
          // What is being asked, so the list starts at the top when it changes
          // — the kind as well as the query, since `/` and `@` can both be
          // armed with nothing typed after them and those are two questions.
          asking={`${found()?.kind ?? ""}:${found()?.query ?? ""}`}
          within={() => input}
          onDismiss={dismiss}
        />
      </Show>

      {/* THE `@` LIST'S OWN BAD NEWS, and only ever its own: the node half is a
          call now, and a call that did not arrive must not read as a word that
          named nothing (HACKING.md — an error reaches somebody). It is drawn
          while the box is naming something, beside the list it is about, and it
          it is not the send's refusal slot — two unrelated failures sharing one
          sentence is how a reader is told the wrong thing about the wrong
          thing (`../search/nodes.ts` argues it at the source). The FILE half
          is unaffected and still answers.

          The BOX IS NEVER DISABLED for it: this one is a sentence somebody is
          writing, and taking it away because the directory cannot be searched
          would cost them the message (the "NEVER disabled" argument below,
          kept). It used to be said as a contrast with the filter bar, whose box
          DID go inert on a dead wire; that face is gone, because a wire which
          cannot carry a question now freezes the whole app under an overlay
          (`../connection/Offline.tsx`) and there is no box left to disable. So
          what is left here is the narrower case it was always really about — a
          search that FAILED on a live wire.

          BOTH conditions are load-bearing: `createSearch` clears its failure
          when the query goes away, but a call already in flight can fail after
          that — and a reason for a list nobody can see is a line about
          nothing. */}
      <Show when={naming() !== null && nodesNamed.failure()}>
        {(said) => (
          <SaidLine
            said={{ tone: "alarm", text: `the directory could not be searched — ${said()}` }}
            class="m-0 mb-1 font-mono text-xs"
            testid={TESTID.chatNamingFailure}
          />
        )}
      </Show>

      {/* Above the box, where what is being typed is: what this message is
          ABOUT is part of it until it is sent, and removable until then. Over
          the attachments rather than under them because it is the subject of
          the sentence and they are what came with it. */}
      <ContextChips nodes={armed()} onRemove={unname} />

      {/* Above the box, where what is being typed is: an attachment is part of
          the message until it is sent. */}
      <Attachments
        names={props.holding.pending().map((attachment) => attachment.name)}
        onRemove={props.holding.remove}
      />

      {/* The box takes the whole width and the controls sit UNDER it, rather
          than three things of three different shapes sharing a row. A textarea
          two lines tall beside a pair of one-line buttons has no alignment that
          is right: bottom-aligned they hang off its corner, centred they float
          in the middle of it. A row of its own gives them one edge to line up
          on, and gives the box the width it is actually for. */}
      {/* NEVER disabled. It was, on the reasoning that the server refuses a
          send mid-turn — but the refusal was the thing to fix, not the box.
          Turning it off cost the caret, so coming back meant reaching for the
          mouse, and it cost the thought: a person watching an agent work has
          the next message ready long before it is finished, and holding it in
          their head until a box comes back is work the panel invented. */}
      <textarea
        ref={input}
        class="w-full resize-none rounded-xl border border-rule/80 bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        data-testid={TESTID.chatInput}
        rows={2}
        placeholder={working() ? "…or say the next thing" : "ask the agent…"}
        value={draft()}
        // ONE KEYSTROKE IS ONE QUESTION, which is what `batch` buys and it is
        // not a micro-optimisation: the list is a memo of the draft AND the
        // caret, both of which every character moves, and Solid does not batch
        // an event handler — so two writes ran the whole of `offers()` twice
        // for one key, the second time to the same answer.
        //
        // What is claimed here is the COUNT — one recompute where there were
        // two — because that is what this can be held to; what a recompute
        // costs is the matcher's, and `@olai/format`'s `filter.bench.ts` is
        // where that number lives (about 10ms per keystroke over 20k nodes, so
        // the pair was around a 16ms frame). An earlier version of this comment
        // quoted a before-and-after in milliseconds for the `batch` itself,
        // which no bench in this repo measured: that bench runs the matcher and
        // never Solid, so the two figures were two runs of the same arm.
        onInput={(event) => {
          batch(() => {
            setDraft(event.currentTarget.value)
            readCaret()
            // Typing takes the popover back off the button: what is on screen
            // should be what the line says, not what a click said a moment ago.
            setAsked(false)
          })
        }}
        // The caret is the element's own answer, so everything that could have
        // moved it re-reads it — a click into the middle of a sentence arms the
        // `@` that is there as surely as typing one does.
        onClick={readCaret}
        onSelect={readCaret}
        onFocus={readCaret}
        onKeyDown={onKey}
        // The clipboard's FILES, not its items: a screenshot pastes as one,
        // and text pasted alongside goes on being pasted — nothing is
        // prevented unless there is a file to take.
        onPaste={(event) => {
          const files = [...(event.clipboardData?.files ?? [])]
          if (files.length === 0) return
          event.preventDefault()
          void props.holding.take(files)
        }}
      />

      <div class="mt-2 flex items-center gap-2">
        {/* The only way in on a phone, which has no Ctrl+V and nothing to drag
            from. `capture` is deliberately absent: a picture is usually one
            already in the roll, and naming a camera would make that the
            second-class case.

            `accept` is SPELLED FROM THE GATE rather than said again as
            `image/*`: a picker that will not offer a PDF the gate would take
            is a gate that is half true, and the half a person meets first —
            they never see the refusal, they see a file greyed out in a dialog
            with no explanation anywhere. */}
        <input
          ref={picker}
          type="file"
          accept={ATTACHMENT_EXTENSIONS.join(",")}
          multiple
          class="hidden"
          onChange={(event) => {
            void props.holding.take([...(event.currentTarget.files ?? [])])
            // Cleared so picking the SAME file twice fires `change` twice.
            event.currentTarget.value = ""
          }}
        />
        <button
          type="button"
          class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
          data-testid={TESTID.chatAttachButton}
          aria-label="attach a file"
          onClick={() => picker?.click()}
        >
          +
        </button>
        {/* What is in flight. A picture big enough to notice is a picture
            whose upload is worth saying is happening. */}
        <Show when={props.holding.sending() > 0}>
          <span class="font-mono text-[0.6875rem] text-muted">
            attaching{props.holding.sending() > 1 ? ` ${props.holding.sending()}` : ""}…
          </span>
        </Show>
        {/* The turn is stopped on a PERSON, and this is where they find out.
            A blocked question has no clock behind it: nothing times out, the
            agent will wait as long as it takes, and a form scrolled off the top
            of a long transcript is otherwise indistinguishable from an agent
            that is thinking. So the composer — which is where somebody's
            attention is, because it is where they were about to type — says
            it, on the toolbar under the box. */}
        <Show when={props.chat.state().asking > 0}>
          <span
            class="font-mono text-[0.6875rem] text-doing"
            data-testid={TESTID.chatWaiting}
            aria-live="polite"
          >
            waiting on your answer
          </span>
        </Show>
        {/* Only when the agent offers some: a button that opens nothing lies. */}
        <Show when={props.chat.state().commands.length > 0}>
          <button
            type="button"
            class={`${CONTROL} w-8 border-rule font-mono text-muted hover:text-ink`}
            data-testid={TESTID.chatCommands}
            aria-label="show the agent's slash commands"
            onClick={askForAll}
          >
            /
          </button>
        </Show>
        <span class="flex-1" />
        <Show when={working()}>
          <button
            type="button"
            class={`${CONTROL} border-alarm px-3 text-alarm`}
            data-testid={TESTID.chatCancel}
            onClick={() => props.chat.cancel()}
          >
            cancel
          </button>
        </Show>
        <button
          type="button"
          class={`${CONTROL} border-transparent bg-accent px-3 font-semibold text-paper hover:opacity-90`}
          data-testid={TESTID.chatSend}
          onClick={() => void send()}
        >
          {/* ALWAYS "send", because that is always what it does. It used to
              read "queue" while a turn ran, which was honest about the panel
              holding the message and is a lie now: what is typed goes to the
              agent as it is typed, into the turn it is already running. */}
          send
        </button>
      </div>
    </div>
  )
}
