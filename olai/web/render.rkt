#lang racket/base

;; The web view's components, composed. One file per visually distinct surface,
;; and this is the file that says which they are and in what order.
;;
;;   web/assets    the /static/ surface: no look, no markup
;;   web/states    the modifiers every surface qualifies its classes with
;;   web/address   a node's DOM id, and what a link to one wears
;;   web/pills     what a date and an in-progress state read like
;;   web/node      the shell both panes wear: row, toggle, title, note
;;   web/checkbox  the box you press, in three readings
;;   web/document  the file a node's @doc attaches, one line or whole
;;   web/outline   the main pane: a section per file, nodes stacked under it
;;   web/crumbs    the trail above a zoomed node
;;   web/search    the palette a query opens, over everything
;;   web/sidebar   brand, Today, Search, Starred, prefs, the file tree — a
;;                 live region
;;   web/banner    what a file being broken looks like
;;   web/stream    the connection's health, in one pill
;;   web/page      the document: head, body, the live region, the composition
;;   web/zoom      one node with its trail: the other pane a route can draw
;;
;; The first three draw nothing and register no rule, so where they sit cannot
;; matter. Everything after them is a surface you can point at on a screen.
;;
;; ORDER IS THE CASCADE. A fragment's layer decides first, and inside a layer
;; the modules come out in the order they were instantiated — which is the
;; order they are required (see web/style). So the require list below is not a
;; list of dependencies; it is the sheet's running order, written out. Two
;; places naming it would be two places to keep in step, so this is the only
;; one: web/skin requires THIS, and the outline's own parts are ordered here.
;;
;; Nothing is defined in this file. A component that grew here would be a
;; component with no module of its own, which is the state this file exists to
;; make impossible.

(require olai/web/theme
         ;; what a rendered title or note wears
         olai/web/markdown
         ;; the picker the sidebar places and the boot script the page carries.
         ;; Named here, ahead of every component, because its rules have to
         ;; land before anything that overrides them and it is not this layer's
         ;; job to remember which module happened to pull it first
         olai/web/prefs
         olai/web/assets
         olai/web/states
         olai/web/address
         olai/web/pills
         olai/web/node
         olai/web/checkbox
         olai/web/document
         olai/web/outline
         olai/web/crumbs
         ;; before the sidebar, which draws the row that opens it
         olai/web/search
         olai/web/sidebar
         olai/web/banner
         olai/web/stream
         olai/web/page
         olai/web/zoom)

;; The drawing surface, as one door: the server and the tests require this and
;; get every renderer, contracted by the module that owns it. Re-exported
;; rather than re-wrapped — a second contract on the same function is a second
;; place for it to be wrong.
(provide (all-from-out olai/web/assets
                       olai/web/states
                       olai/web/address
                       olai/web/pills
                       olai/web/node
                       olai/web/checkbox
                       olai/web/document
                       olai/web/outline
                       olai/web/crumbs
                       olai/web/search
                       olai/web/sidebar
                       olai/web/banner
                       olai/web/stream
                       olai/web/page
                       olai/web/zoom)
         ;; the render-time Markdown surface, from the module that owns it
         (all-from-out olai/web/markdown))
