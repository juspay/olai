#lang racket/base

;; Client prefs: the picker in the sidebar, and the script that restores it.
;;
;; The page is a VIEW, and what it looks like to YOU is CLIENT state: stored in
;; this browser, never sent anywhere, exactly like the collapse state. The theme
;; is the first one; density and type size are the obvious next ones, and they
;; are meant to be rows here rather than a second mechanism.
;;
;; A pref is a NAME, a LABEL, the values it may take and the one that is in
;; force when nothing is stored. The name is two things at once — a data
;; attribute on <html> (data-theme) and the tail of the localStorage key
;; (olai.theme) — which is what lets one script drive every row and one boot
;; script restore them all (static/prefs.js, and prefs-boot-js below). The label
;; is what a person reads; a name is for machines, and the day the two want to
;; differ they can.
;;
;; Nothing stored is not a value of its own: it is the DEFAULT, which the sheet
;; already draws (web/theme, the bare :root) and the row carries so the picker
;; can light that chip. Every chip is a theme, and picking one is picking it —
;; there is no OS to defer to and nothing to switch under you.

(require racket/contract
         racket/string
         (only-in json jsexpr->string)
         olai/web/style
         (only-in olai/web/theme
                  theme-attribute theme-names theme-default
                  paper-2 pill-bg line ink dim green mono micro-size))

(provide (contract-out
          ;; the picker, for the sidebar to place. `list?` and not `xexpr?`:
          ;; the shape check is the renderer's business (see web/render)
          [prefs-xexpr (-> list?)]
          ;; the <head> script that puts stored prefs on <html> before the
          ;; first paint. A string of JS, generated from the list below
          [prefs-boot-js (-> string?)]))

;; ---- what a pref is -------------------------------------------------------

(struct pref (name label values default) #:transparent)

;; The key this browser stores a pref under. Spelled ONCE, here: the boot
;; script is handed the finished key and the row carries it in an attribute, so
;; neither .js has to know how one is built.
(define (pref-storage-key p) (string-append "olai." (pref-name p)))

;; The name is the tail of the attribute the sheet keys off — data-theme is
;; the theme pref — so there is one string, and it is web/theme's.
(define (attribute->pref-name attribute)
  (unless (string-prefix? attribute "data-")
    (error 'prefs "~a is not a data- attribute; a pref name is its tail" attribute))
  (substring attribute (string-length "data-")))

(define client-prefs
  (list (pref (attribute->pref-name theme-attribute) "theme"
              theme-names theme-default)))

;; A pref name lands in three places that will not all complain: an attribute
;; name ('data-'+name), a storage key, and a CSS selector. Anything outside
;; this grammar breaks one of them quietly. And a default that is not one of
;; the values is a row where nothing is ever lit.
(for ([p (in-list client-prefs)])
  (unless (regexp-match? #px"^[a-z][a-z0-9-]*$" (pref-name p))
    (error 'prefs "~s is not a pref name: [a-z][a-z0-9-]*" (pref-name p)))
  (when (null? (pref-values p))
    (error 'prefs "the ~a pref offers no values" (pref-name p)))
  (unless (member (pref-default p) (pref-values p))
    (error 'prefs "the ~a pref defaults to ~s, which it does not offer"
           (pref-name p) (pref-default p))))

;; ---- the boot script ------------------------------------------------------

;; INLINE-NESS IS LOAD-BEARING. A pref stored in this browser has to be on
;; <html> before the first paint; every /static/ script is deferred, so it
;; would land after it, which is a flash of the wrong colors on every load.
;; This much runs in <head>, and nothing else does: the rows, and everything
;; that happens after a click, are static/prefs.js.
;;
;; It writes with setAttribute, not dataset[name]: a hyphenated pref name is
;; not a dataset key, and the setter throws rather than working.
;;
;; A future Content-Security-Policy has to hand this script a nonce (or hash
;; it); there is no file to point script-src at.
;;
;; The pairs are generated from client-prefs, and each is [name, storage-key] —
;; the key is built in Racket (pref-storage-key) so no .js spells 'olai.'.
;; Written by the json library, which is what escapes them.
(define (prefs-boot-js)
  (string-append
   "try{"
   (jsexpr->string (for/list ([p (in-list client-prefs)])
                     (list (pref-name p) (pref-storage-key p))))
   ".forEach(function(p){"
   "var v=localStorage.getItem(p[1]);"
   "if(v)document.documentElement.setAttribute('data-'+p[0],v)})}catch(e){}"))

;; ---- the picker -----------------------------------------------------------

;; which value a row is in. Only the browser knows — the server draws the same
;; rows for everyone — so prefs.js is what marks it.
(define-modifier is-on)

(define-component (pref-opt-xexpr value)
  #:class ol-pref-opt
  #:css (#:padding (0.0625rem 0.375rem)
         #:border (1px solid ,line)
         #:border-radius 9999px
         #:background ,paper-2
         #:color ,dim
         #:font-family ,mono
         #:font-size ,micro-size
         #:cursor pointer
         [(: & hover) #:color ,ink #:border-color ,dim]
         ;; the one in force
         [,(sel '& is-on) #:background ,pill-bg #:color ,green #:border-color ,green])
  `(button ((type "button") (class ,ol-pref-opt) (data-value ,value)
            (aria-pressed "false"))
           ,value))

(define-style ol-pref-opts #:display flex #:flex-wrap wrap #:gap 0.25rem)

(define-style ol-pref-label
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,dim)

;; One row: what it is called, and every value it takes. `data-pref` is the
;; name, `data-store-key` is where this browser keeps it, `data-default` is
;; what is in force until it keeps anything — the script reads all three rather
;; than knowing a class per pref, how a key is spelled, or which theme the
;; sheet falls back to, which is what makes the second row cost nothing.
(define-component (pref-row-xexpr p)
  #:class ol-pref
  #:css (#:display flex #:flex-direction column #:gap 0.25rem)
  `(div ((class ,ol-pref)
         (data-pref ,(pref-name p))
         (data-store-key ,(pref-storage-key p))
         (data-default ,(pref-default p)))
        (div ((class ,ol-pref-label)) ,(pref-label p))
        (div ((class ,ol-pref-opts))
             ,@(for/list ([v (in-list (pref-values p))]) (pref-opt-xexpr v)))))

(define-component (prefs-xexpr)
  #:class ol-prefs
  #:css (#:display flex
         #:flex-direction column
         #:gap 0.625rem
         #:margin-left 0.5rem)
  `(div ((class ,ol-prefs))
        ,@(for/list ([p (in-list client-prefs)]) (pref-row-xexpr p))))
