/**
 * THE SEAT — the spot at the foot of a page where something about THAT PAGE is
 * drawn, today a conversation about it.
 *
 * Three owners, and each keeps to its own part:
 *
 *   - NAVIGATION owns the contract ({@link pageSeats} in `./index.ts`) and
 *     hands the page it draws what was contributed there, through
 *     {@link SeatsProvider} around every page `./PageView.tsx` dispatches. It
 *     reads the location through its own renderer component, so with no
 *     renderer nothing is contributed and every seat is empty.
 *   - A PAGE FRAME places the seat ({@link PageSeat}) and says which place it
 *     is drawing — the file of a document or an outline, a plugin's page — and
 *     what that place is called. Only the frame knows: the front page `/` and
 *     `house.olai#install` are both the outline `house.olai` once it is drawn.
 *   - A CONTRIBUTOR fills it, for the life of its own activation. When it
 *     leaves, its seat leaves with it and the page is whole.
 *
 * A frame drawn outside any page view (an embedded document, a preview card)
 * has no seats handed to it and draws none.
 */
import { type Accessor, createContext, For, type JSX, useContext } from "solid-js"
import type { PageSeat as Contributed, SeatProps } from "./index.ts"

const SeatsContext = createContext<Accessor<ReadonlyArray<Contributed>>>()

/** Around a page: what is contributed at the seat, as the page view read it. */
export function SeatsProvider(props: { readonly seats: Accessor<ReadonlyArray<Contributed>>; readonly children: JSX.Element }) {
  return <SeatsContext.Provider value={props.seats}>{props.children}</SeatsContext.Provider>
}

/** The seat, placed by a page frame: every contribution, told which place the
 *  page is and what it is called. */
export function PageSeat(props: SeatProps) {
  const seats = useContext(SeatsContext)
  return <For each={seats?.() ?? []}>{seat => <seat.Seat place={props.place} name={props.name} />}</For>
}
