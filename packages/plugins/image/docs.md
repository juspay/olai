# Image

Image claims supported picture suffixes and draws an image preview and file glyph. The vault serves the bytes through its claim-gated media route; a revision change points the image at fresh bytes.

The row owns the picture suffix list. Its page and glyph activate independently. Turning the row off removes its files from the tree and media route; turning it on restores them from the current directory. Missing and restored files update an open page without reloading the app.

The picture on that page is fetched eagerly and asked for ahead of the page's other fetches, because it is the only thing on the page: whatever a browser ends up measuring as the largest paint here, this is it. That is the opposite of a picture inside a document, where everything after the first one waits for the reader to scroll near it ([format.md](../format.md#documents)). Decoding is handed off the main thread in both places, so a screenshot saved at four thousand pixels does not stall the frame the rest of the page draws in.

Page metadata is read from `vault.files.bodyPage`; disabling Markdown does not withdraw this page.
