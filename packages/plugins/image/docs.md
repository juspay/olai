# Image

Image claims supported picture suffixes and draws an image preview and file glyph. The vault serves the bytes through its claim-gated media route; a revision change points the image at fresh bytes.

The row owns the picture suffix list. Its page and glyph activate independently. Turning the row off removes its files from the tree and media route; turning it on restores them from the current directory. Missing and restored files update an open page without reloading the app.

Page metadata is read from `vault.files.bodyPage`; disabling Markdown does not withdraw this page.
