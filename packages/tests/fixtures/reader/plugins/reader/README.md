# Reader

A companion for reading a book in French, with the pages and the words you are learning kept in your notes.

Each sentence of the book is a row whose `reader-pair` property holds the French, ` | `, and the English, and the plugin draws the two side by side under the row. It also adds a **Reading** section to the sidebar with a link to the book and one to your vocabulary, a key that opens your vocabulary, and a palette row that opens the book.

Click a French word and it becomes a row of your vocabulary. Open the Vocabulary row and the foot of its page asks the word due longest, and Again, Good or Easy writes when it is due next.

The review is also a page of its own: choose Start review in the palette, press Cmd + Shift + E, or follow Review in the sidebar.

In any note, a block whose fence names `reader` is drawn the same way, one sentence and its English to a line:

```reader
Phileas Fogg vivait seul. | Phileas Fogg lived alone.
```
