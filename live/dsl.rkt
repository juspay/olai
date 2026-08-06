#lang racket/base

;; The forms: the same live view, declared instead of agreed.
;;
;; live/client and live/hub are complete without this file. What they cannot do
;; is check the COINCIDENCES between them — the region id a link aims at, the
;; event name a producer broadcasts and a drawer triggers on, the id a row is
;; keyed by. Each of those is one string that has to be the same string in two
;; files, and the compiler sees two unrelated literals. Misspell one and
;; nothing fails: the page renders, the stream connects, and a region silently
;; stops moving. That failure is a browser away, which is exactly the feedback
;; an agent cannot get.
;;
;; So: write each name ONCE, as a declaration, and let every other appearance
;; be a reference the expander resolves — or refuses, with a source location,
;; before a server boots.
;;
;;   (define-stream counts #:events (counts-changed) #:heartbeat 15)
;;   (define-live-region clist #:stream counts)
;;
;;   (live-connect counts #:cursor cursor)     ; on the body
;;   (live-region clist #:href href)           ; on the element that redraws
;;   (live-link clist "/c/alpha")              ; on a link into it
;;   (live-item clist li "alpha" ...)          ; on one row of it
;;   (stream-frame counts 'counts-changed cursor #:id cursor)
;;   (stream-event counts 'counts-changed)     ; the name, where DATA carries it
;;
;; Two rules shape everything below.
;;
;; THIN. Every form expands into a call on the functional API and nothing else
;; — no runtime of its own, no generated JavaScript, no state. `just expand
;; FILE` prints what any of them turns into. A consumer who does not want the
;; sugar calls `make-live-view` and friends directly and loses only the checks;
;; that escape hatch is what lets these stay strict.
;;
;; NO FORM WITHOUT A CHECK. Sugar for terseness alone is a convention wearing a
;; uniform, and it rots like one. Each form here earns its place by refusing a
;; specific misspelling, and the refusal is the interface: source location
;; first, then the rule that was violated, then what IS in scope, then a
;; did-you-mean. Longer than you would write for a human, on purpose.

(require (for-syntax racket/base
                     racket/list
                     racket/string
                     syntax/parse)
         live/client
         live/frame)

(provide define-stream
         stream-frame
         stream-event
         stream-heartbeat
         define-live-region
         live-connect
         live-region
         live-link
         live-item)

;; ---- what a declaration leaves behind ---------------------------------------

(begin-for-syntax

  ;; A declared name is a COMPILE-TIME record and no runtime value at all:
  ;; everything it holds is known while the module is being expanded, and
  ;; anything left over would be a second place for the same fact to live.
  ;; Using one as an expression is therefore an error — and a message naming
  ;; the forms it IS for beats "illegal use of syntax".

  ;; The head of an application, or the identifier itself: whichever the
  ;; programmer actually wrote in the place that is wrong.
  (define (offending stx)
    (cond
      [(identifier? stx) stx]
      [(pair? (syntax-e stx)) (car (syntax-e stx))]
      [else stx]))

  (define (not-a-value stx noun forms)
    (raise-syntax-error
     #f
     (string-append
      "a " noun " is not a value\n"
      "  it names a " noun " for the live forms: " forms "\n"
      "  live/README.md has the grammar for each")
     (offending stx)))

  ;; events    : (listof symbol?) — the vocabulary, in declaration order
  ;; heartbeat : a positive number, or #f to take the transport's own cadence
  (struct stream-decl (events heartbeat)
    #:property prop:procedure
    (λ (self stx)
      (not-a-value stx "live stream"
                   "stream-frame, stream-heartbeat, define-live-region, live-connect")))

  ;; id        : the element id, minted from the declared name
  ;; event     : the one event name this region redraws on
  ;; history?  : whether Back restores THIS region (see live/client)
  (struct region-decl (id event history?)
    #:property prop:procedure
    (λ (self stx)
      (not-a-value stx "live region" "live-region, live-link, live-item")))

  ;; ---- what is in scope, for the error messages ------------------------------

  ;; An unbound name is only half an error message; the other half is what the
  ;; programmer could have written instead. There is no way to ask the expander
  ;; "which regions are visible here", so declarations record themselves as
  ;; they are expanded, keyed by the file they were written in.
  ;;
  ;; Which means the candidate list is what THIS MODULE declares, and a name
  ;; imported from another module is not in it. That is why the empty case does
  ;; not say "nothing is in scope" — it says where to go looking.

  ;; (cons kind source) -> (listof (cons symbol string))
  (define declared (make-hash))

  (define (declare! kind id)
    (define name (syntax-e id))
    (hash-update! declared
                  (cons kind (syntax-source id))
                  (λ (previous)
                    ;; a module expanded twice in one process declares twice
                    (cons (cons name (form-loc id))
                          (filter (λ (e) (not (eq? (car e) name))) previous)))
                  '()))

  (define (declarations kind stx)
    (reverse (hash-ref declared (cons kind (syntax-source stx)) '())))

  (define (form-loc stx)
    (format "~a:~a:~a" (source-name stx) (or (syntax-line stx) 0) (or (syntax-column stx) 0)))

  (define (source-name stx)
    (define s (syntax-source stx))
    (cond
      [(path? s)
       (define-values (_base name _dir) (split-path s))
       (if (path? name) (path->string name) (format "~a" s))]
      [else (format "~a" s)]))

  ;; ---- did you mean ----------------------------------------------------------

  ;; Zero dependencies is a rule here and the distribution ships no edit
  ;; distance, so this is the textbook two-row Levenshtein — at the size of an
  ;; identifier, over a handful of candidates, in a branch that only runs when
  ;; the compile is already failing.
  (define (edit-distance a b)
    (define m (string-length b))
    (for/fold ([row (build-list (add1 m) values)] #:result (last row))
              ([i (in-range 1 (add1 (string-length a)))])
      (for/fold ([out (list i)] #:result (reverse out))
                ([j (in-range 1 (add1 m))])
        (cons (min (add1 (car out))                       ; delete
                   (add1 (list-ref row j))                ; insert
                   (+ (list-ref row (sub1 j))             ; substitute
                      (if (char=? (string-ref a (sub1 i)) (string-ref b (sub1 j))) 0 1)))
              out))))

  ;; Two edits: enough for a transposition (`clsit`) or a dropped letter
  ;; (`count-changed`), tight enough that an unrelated name is never offered.
  (define (did-you-mean name candidates)
    (define scored (for/list ([c (in-list candidates)])
                     (cons (edit-distance (symbol->string name) (symbol->string c)) c)))
    (define best (and (pair? scored) (argmin car scored)))
    (and best (<= (car best) 2) (cdr best)))

  (define (suggestion-line name candidates)
    (define hit (did-you-mean name candidates))
    (if hit (string-append "\n  did you mean: " (symbol->string hit) "?") ""))

  (define (comma-list names)
    (string-join (for/list ([n (in-list names)]) (format "~a" n)) ", "))

  ;; ---- resolving a declared name ---------------------------------------------

  ;; kind : 'stream | 'region — and the words every message about one uses.
  (define (kind-noun kind) (if (eq? kind 'stream) "stream" "region"))
  (define (kind-plural kind) (if (eq? kind 'stream) "streams" "regions"))
  (define (kind-declarer kind) (if (eq? kind 'stream) "define-stream" "define-live-region"))
  (define (kind-decl? kind v) (if (eq? kind 'stream) (stream-decl? v) (region-decl? v)))

  ;; The one door every form goes through: `id` names a declaration of `kind`,
  ;; or the compile stops here with the whole story.
  ;;
  ;; who  : the form that is complaining
  ;; role : where in that form the name sat, in the words of its grammar
  (define (live-lookup kind id who role)
    (define v (and (identifier? id) (syntax-local-value id (λ () #f))))
    (cond
      [(kind-decl? kind v) v]
      [else
       (define bound? (and (identifier? id) (identifier-binding id) #t))
       (define entries (declarations kind id))
       (raise-syntax-error
        #f
        (string-append
         (if bound? "not a live " "unbound live ") (kind-noun kind) "\n"
         "  " (symbol->string who) "'s " role " must be a " (kind-noun kind)
         " bound by " (kind-declarer kind) "\n"
         (if bound?
             (string-append "  " (symbol->string (syntax-e id))
                            " is bound here, but to something else\n")
             "")
         (if (null? entries)
             (string-append "  this module declares no " (kind-plural kind)
                            ": declare one with " (kind-declarer kind)
                            ", or require it from the module that does")
             (string-append "  " (kind-plural kind) " in scope in this module: "
                            (string-join
                             (for/list ([e (in-list entries)])
                               (format "~a (declared at ~a)" (car e) (cdr e)))
                             ", ")))
         (suggestion-line (syntax-e id) (map car entries)))
        id)]))

  ;; A stream's vocabulary is closed: an event it never declared is a typo,
  ;; every time.
  (define (check-event sd stream-id ev who)
    (define events (stream-decl-events sd))
    (define name (symbol->string (syntax-e stream-id)))
    (unless (memq (syntax-e ev) events)
      (raise-syntax-error
       #f
       (string-append
        "not an event of " name "\n"
        "  " (symbol->string who) "'s event must be one of the names " name
        " declares with #:events\n"
        "  events of " name ": " (comma-list events)
        (suggestion-line (syntax-e ev) events))
       ev)))

  ;; `'counts-changed`, and nothing that has to be run to find out.
  (define (literal-event e who)
    (syntax-parse e
      [((~literal quote) name:id) #'name]
      [_ (raise-syntax-error
          #f
          (string-append
           "not a literal event\n"
           "  " (symbol->string who)
           "'s event must be a quoted name, like 'counts-changed\n"
           "  an event name that is computed is an event name nothing can check")
          e)]))

  ;; '(a b c) -> '(() (a) (a b)): what had already been seen at each element.
  (define (inits xs)
    (for/list ([i (in-range (length xs))]) (take xs i)))

  ;; ---- the dump --------------------------------------------------------------

  ;; Every form labels its own output with the form that produced it, so
  ;; `just expand FILE` can print the pair without re-deriving anything. The
  ;; expansion is part of the interface and not a debugging convenience: the
  ;; only way to answer "what does this actually put on the page" is to look.
  (define (tag src out)
    (syntax-property out 'live-form (cons src (syntax->datum out)))))

;; ---- the producer's end ------------------------------------------------------

;; (define-stream name #:events (event-name ...+) [#:heartbeat seconds])
;;
;; Declares a stream's vocabulary, in the module that PRODUCES it. `name` is
;; bound for this module and any that requires it; the events are the complete
;; set of names anything may send on it or trigger from it.
;;
;;   (define-stream counts #:events (counts-changed) #:heartbeat 15)
;;
;; `#:events` is append-only, like a JSON reply's fields: adding a name is a
;; one-line change, removing one is an expansion error at every use until the
;; last of them is gone. Wire skew across a deploy is not this list's problem —
;; the stream's address carries the server's identity (live/frame), so a page
;; drawn by yesterday's build is told to reload rather than left subscribed to
;; a name nobody sends any more.
;;
;; `#:heartbeat` is the cadence in seconds, read back by `stream-heartbeat`
;; where the app answers the stream. A page has ONE connection and every event
;; name rides it, so the beat belongs to the connection: declare it on the
;; stream the app answers with, and leave it off the others.
(define-syntax (define-stream stx)
  (syntax-parse stx
    [(_ name:id
        (~alt (~once (~seq #:events (event:id ...+)))
              (~optional (~seq #:heartbeat beat:number)))
        ...)
     (define events (syntax->list #'(event ...)))
     (for ([e (in-list events)] [seen (in-list (inits (map syntax-e events)))])
       (when (memq (syntax-e e) seen)
         (raise-syntax-error
          #f
          (string-append
           "duplicate event name\n"
           "  define-stream's #:events must name each event once\n"
           "  events of " (symbol->string (syntax-e #'name)) " before it: " (comma-list seen))
          e)))
     (define cadence (and (attribute beat) (syntax-e (attribute beat))))
     (when (and cadence (not (positive? cadence)))
       (raise-syntax-error
        #f
        (string-append
         "not a cadence\n"
         "  define-stream's #:heartbeat is a number of seconds, and must be positive")
        (attribute beat)))
     (declare! 'stream #'name)
     (tag stx
          #`(define-syntax name (stream-decl '#,(map syntax-e events) #,cadence)))]))

;; (stream-frame stream 'event data [#:id id]) -> frame?
;;
;; One frame in `stream`'s vocabulary. The event is checked against the
;; declaration; everything else is `make-frame`'s, unchanged — the payload is a
;; string this framework never reads, and `#:id` is the cursor a client hands
;; back when it comes home.
;;
;;   (stream-frame counts 'counts-changed cursor #:id cursor)
;;   (stream-frame clock 'clock-tick (clock-now))      ; a tick is no checkpoint
;;
;; A frame rather than a send, because a frame is what both places want: one
;; goes to `hub-broadcast!` when something moves, and the same one goes to the
;; connection that missed it in `#:catch-up`.
(define-syntax (stream-frame stx)
  (syntax-parse stx
    [(_ stream:id event:expr data:expr
        (~optional (~seq #:id id:expr) #:defaults ([id #'#f])))
     (define sd (live-lookup 'stream #'stream 'stream-frame "first argument"))
     (define ev (literal-event #'event 'stream-frame))
     (check-event sd #'stream ev 'stream-frame)
     (tag stx #`(make-frame #,(symbol->string (syntax-e ev)) data #:id id))]))

;; (stream-event stream 'event) -> string?
;;
;; One event name, as the string it is on the wire — for the places a name has
;; to travel as DATA rather than as a frame. The page has one stream and every
;; event rides it, so a panel whose payload is not markup subscribes to a name
;; in the browser (`live.on`); the name reaches it on an attribute, and this is
;; the checked way to write one.
;;
;;   (span ((data-chat-event ,(stream-event chat-events 'chat))))
;;
;; The alternative is a string literal in the drawer and the same string in the
;; producer, which is the coincidence this whole module exists to refuse.
(define-syntax (stream-event stx)
  (syntax-parse stx
    [(_ stream:id event:expr)
     (define sd (live-lookup 'stream #'stream 'stream-event "first argument"))
     (define ev (literal-event #'event 'stream-event))
     (check-event sd #'stream ev 'stream-event)
     (tag stx #`#,(symbol->string (syntax-e ev)))]))

;; (stream-heartbeat stream) -> (>/c 0)
;;
;; The cadence `stream` declared, or the transport's own when it declared none.
;; Where an app answers the stream:
;;
;;   (hub-response hub #:heartbeat-seconds (stream-heartbeat counts) ...)
(define-syntax (stream-heartbeat stx)
  (syntax-parse stx
    [(_ stream:id)
     (define sd (live-lookup 'stream #'stream 'stream-heartbeat "first argument"))
     (define beat (stream-decl-heartbeat sd))
     (tag stx (if beat #`#,beat #'live-default-heartbeat-seconds))]))

;; ---- the drawer's end --------------------------------------------------------

;; (define-live-region name #:stream stream
;;                          [#:event event-name] [#:history? bool] [#:id string])
;;
;; Declares the region a module DRAWS: one element that re-fetches its own
;; address and morphs the reply onto itself. `name` is the element's id, so it
;; is written once and every selector, target and link is derived from it.
;;
;;   (define-live-region clist #:stream counts)
;;   (define-live-region ticker #:stream clock #:history? #f)
;;
;; `#:id` is for the one case the default cannot serve: a module that already
;; binds that name for something else — a CSS class of the same spelling, most
;; likely, since an element's class and its id often want the same word. Then
;; the BINDING is renamed and the id stays what the page has always called it.
;; Spelled out on one line rather than left to drift, and a literal, so it is
;; still written exactly once.
;;
;; `#:event` names which of the stream's events this region redraws on, and may
;; be left out when the stream declares exactly one — with two or more, leaving
;; it out is an error rather than a guess.
;;
;; `#:history?` is the page-global decision htmx forces on us: it honours the
;; FIRST history element in the document, so with two regions on a page one of
;; them must yield or Back restores the wrong one. Default #t.
(define-syntax (define-live-region stx)
  (syntax-parse stx
    [(_ name:id
        (~alt (~once (~seq #:stream stream:id))
              (~optional (~seq #:event event:id))
              (~optional (~seq #:history? history:boolean))
              (~optional (~seq #:id element-id:str)))
        ...)
     (define sd (live-lookup 'stream #'stream 'define-live-region "#:stream"))
     (define events (stream-decl-events sd))
     (define name-str
       (if (attribute element-id)
           (syntax-e (attribute element-id))
           (symbol->string (syntax-e #'name))))
     (define chosen
       (cond
         [(attribute event)
          (check-event sd #'stream (attribute event) 'define-live-region)
          (syntax-e (attribute event))]
         [(= 1 (length events)) (car events)]
         [else
          (raise-syntax-error
           #f
           (string-append
            "ambiguous event\n"
            "  define-live-region needs #:event when its stream declares more than one\n"
            "  " name-str " redraws on ONE of " (symbol->string (syntax-e #'stream))
            "'s events: " (comma-list events))
           stx)]))
     (declare! 'region #'name)
     (tag stx
          #`(define-syntax name
              (region-decl #,name-str
                           #,(symbol->string chosen)
                           #,(if (attribute history) (syntax-e (attribute history)) #t))))]))

;; (live-connect stream ...+ [#:cursor cursor]) -> attributes
;;
;; The page's connection, for an ancestor of every region and link on it — the
;; body. ONE EventSource for the page, carrying the vocabularies named here.
;;
;;   (body (,@(live-connect counts clock #:cursor cursor)) ...)
;;
;; `#:cursor` is the state this markup was drawn from, and closes the window
;; between rendering a page and its stream connecting. The address is the
;; transport's (`live-stream-path`) and not the app's: it carries which server
;; drew the page, so a tab that outlives a deploy is told to reload.
(define-syntax (live-connect stx)
  (syntax-parse stx
    [(_ stream:id ...+ (~optional (~seq #:cursor cursor:expr) #:defaults ([cursor #'#f])))
     (for ([s (in-list (syntax->list #'(stream ...)))])
       (live-lookup 'stream s 'live-connect "argument"))
     (tag stx #'(live-stream-attributes live-stream-path cursor))]))

;; (live-region region #:href href) -> attributes
;;
;; The element that redraws itself. `href` is the page's own address — what the
;; region re-fetches and selects itself out of, so one handler serves the first
;; render and every update.
;;
;;   (div (,@(live-region clist #:href href)) (ol ...))
(define-syntax (live-region stx)
  (syntax-parse stx
    [(_ region:id #:href href:expr)
     (define rd (live-lookup 'region #'region 'live-region "first argument"))
     (tag stx
          #`(live-region-attributes
             (make-live-view #:region #,(region-decl-id rd)
                             #:event #,(region-decl-event rd)
                             #:stream live-stream-path
                             #:href href)
             #:history? #,(region-decl-history? rd)))]))

;; (live-link region href) -> attributes
;;
;; A link that fetches `href` into `region` and pushes the address, with the
;; plain href still on it. The region it aims at is a BINDING, which is what
;; makes a link into the wrong surface — the bug this whole file is about —
;; unwritable rather than merely unwritten.
;;
;;   (a (,@(live-link clist (counter-href name))) ,name)
(define-syntax (live-link stx)
  (syntax-parse stx
    [(_ region:id href:expr)
     (define rd (live-lookup 'region #'region 'live-link "first argument"))
     (tag stx #`(live-link-attributes #,(region-decl-id rd) href))]))

;; (live-item region tag key body ...) -> xexpr
;;
;; One thing inside a region, wrapped in `tag` and identified by `key`. Morph
;; matches old to new by id first, so this is what keeps a selection, a focus
;; or a running transition with the row it belongs to when the list reorders
;; underneath it.
;;
;;   (live-item clist li (counter-name c)
;;     `(a ...) `(span ...))          ; => (li ((id "clist-alpha")) ...)
;;
;; The id is MINTED — region name, then key — rather than written, because a
;; written id is an obligation a drawer can forget, and a forgotten one fails
;; by preserving nothing rather than by failing.
(define-syntax (live-item stx)
  (syntax-parse stx
    [(_ region:id elem:id key:expr body:expr ...)
     (define rd (live-lookup 'region #'region 'live-item "first argument"))
     (tag stx
          #`(list 'elem
                  (list (list 'id (live-item-id #,(region-decl-id rd) key)))
                  body ...))]))
