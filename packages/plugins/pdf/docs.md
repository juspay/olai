# PDF

PDF claims PDF files and draws the browser's PDF object viewer and a file glyph. Its server claim controls directory membership and access through the vault's media route.

The glyph and page are separate components. Turning Files off removes the glyph while the PDF page still opens. Turning Navigation off withdraws the page, tree and rail; the glyph component remains mounted with its contribution unread. Turning PDF off withdraws its files and makes media requests refuse them. A browser that will not draw a PDF says `This browser can't show a PDF here.` with an `Open <file>` link to the file itself.

Page metadata is read from `vault.files.bodyPage`; disabling Markdown does not withdraw this page.
