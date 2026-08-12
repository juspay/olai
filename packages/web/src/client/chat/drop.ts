/**
 * What a drag is carrying, read off the browser's own `DataTransfer`.
 *
 * Two questions, and they are asked at DIFFERENT MOMENTS, which is the whole
 * reason this is a module rather than two expressions inside a handler:
 *
 *   - **while the drag is still in the air** (`dragenter` / `dragover`), the
 *     panel has to decide whether to light up. It cannot look at the files:
 *     the spec puts the drag data store in *protected mode* until the drop, so
 *     `dataTransfer.files` is EMPTY the whole way across the panel and only
 *     `types` is readable. A target that waited for the files would never show
 *     an affordance at all.
 *   - **at the drop**, the store is readable and the files are there, in the
 *     order they were dragged.
 *
 * Nothing here reaches past `DataTransfer` — no `webkitGetAsEntry`, no file
 * system access. A dropped DIRECTORY therefore arrives as one entry that is
 * not a picture, and is refused by name like anything else olai does not take,
 * which is the honest answer for a gesture this app has no way to walk.
 */

/**
 * Is this drag carrying files, as opposed to selected text or a link?
 *
 * `"Files"` is the spec's own name for that kind — capital F, in
 * {@link DataTransfer.types} — and it is the only part of the drag data store
 * a listener may read before the drop. Text dragged at the panel answers
 * `false` here, which is what leaves the textarea's own drop behaviour alone:
 * dropping a selection into the box still types it there.
 */
export const carriesFiles = (types: ReadonlyArray<string>): boolean => types.includes("Files")

/**
 * The files of a drop, in the order they were dropped.
 *
 * `FileList` is array-LIKE and the order is the transfer's own, so the whole
 * job is spreading it into something the rest of the panel can map over. It is
 * named anyway because "in order" is a promise this feature makes — several
 * pictures in one drop attach in the order they were dropped — and a promise
 * with a name is one a test can hold.
 */
export const droppedFiles = (transfer: DataTransfer | null): ReadonlyArray<File> =>
  transfer === null ? [] : [...transfer.files]
