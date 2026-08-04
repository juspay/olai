#lang racket/base

;; Interactive HTML outline as a tree: nested lists + native <details>.
;; Titles/notes via markdown package → xexprs. No ANSI. Click a node to
;; expand/collapse (no expand-all chrome).

(require racket/list
         racket/match
         racket/path
         racket/string
         xml
         (only-in xml cdata)
         (only-in markdown parse-markdown)
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/dates
         selfflowy/calendar)

(provide tasks->html
         files->html
         task->xexpr
         page-xexpr
         title->inline-xexprs
         note->xexprs
         sanitize-xexpr)

;; ---- helpers --------------------------------------------------------------

(define (xexpr-tag x)
  (and (list? x) (pair? x) (symbol? (car x)) (car x)))

(define (xexpr-attrs x)
  (match x
    [(list _ (list (list (? symbol?) _) ...) _ ...) (cadr x)]
    [_ '()]))

(define (xexpr-kids x)
  (match x
    [(list _ (list (list (? symbol?) _) ...) kids ...) kids]
    [(list _ kids ...) kids]
    [_ '()]))

(define (make-xexpr tag attrs kids)
  (if (null? attrs)
      (list* tag kids)
      (list* tag attrs kids)))

;; ---- sanitize (no raw HTML injection) -------------------------------------

(define allowed-inline
  (make-hasheq '((em . #t) (strong . #t) (code . #t) (a . #t) (del . #t)
                           (span . #t) (br . #t))))

(define allowed-block
  (make-hasheq '((p . #t) (pre . #t) (ul . #t) (ol . #t) (li . #t)
                           (blockquote . #t) (h1 . #t) (h2 . #t) (h3 . #t)
                           (h4 . #t) (h5 . #t) (h6 . #t) (hr . #t) (div . #t))))

(define (safe-href href)
  (and (string? href)
       (or (regexp-match? #px"^(https?|mailto):" href)
           (regexp-match? #px"^#" href))
       href))

(define (sanitize-attrs tag attrs)
  (case tag
    [(a)
     (define href (safe-href (cond [(assq 'href attrs) => cadr] [else #f])))
     (if href `((href ,href)) '())]
    [else '()]))

;; The markdown package emits smart punctuation as bare entity symbols
;; (mdash, ndash, rsquo, …). We want VERBATIM ASCII for those — ISO dates
;; like 2026-07-31 must keep plain hyphens, quotes stay straight. Other
;; legitimate entities expand to the real Unicode character, never to the
;; entity *name* as text (that produced "2026ndash07ndash31").
;;
;; (current-strict-markdown? #t) would kill smart punctuation but also
;; fenced code blocks and other useful GFM-ish bits, so we normalize after
;; a normal parse instead.
(define smart-punct-ascii
  #hasheq((mdash . "--")
          (ndash . "-")
          (lsquo . "'")
          (rsquo . "'")
          (ldquo . "\"")
          (rdquo . "\"")
          (sbquo . "'")
          (bdquo . "\"")
          (lsaquo . "<")
          (rsaquo . ">")
          (hellip . "...")
          (prime . "'")
          (Prime . "\"")
          (apos . "'")
          (quot . "\"")))

(define named-entity-chars
  #hasheq((middot . "\u00B7")
          (bull . "\u2022")
          (nbsp . "\u00A0")
          (ensp . "\u2002")
          (emsp . "\u2003")
          (thinsp . "\u2009")
          (amp . "&")
          (lt . "<")
          (gt . ">")))

(define (entity-symbol->text sym)
  (or (hash-ref smart-punct-ascii sym #f)
      (hash-ref named-entity-chars sym #f)
      ;; Unknown entity name: never emit the bare name as text.
      ""))

;; Returns a list of sanitized pieces (may flatten forbidden wrappers).
(define (sanitize-pieces x #:inline-only? [inline-only? #f])
  (define (allowed? tag)
    (or (hash-ref allowed-inline tag #f)
        (and (not inline-only?) (hash-ref allowed-block tag #f))))
  (let loop ([x x])
    (cond
      [(string? x) (list x)]
      [(symbol? x) (list (entity-symbol->text x))]
      [(number? x) (list (number->string x))]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (xexpr-kids x))
       (define skids (append* (map loop kids)))
       (if (allowed? tag)
           (list (make-xexpr tag (sanitize-attrs tag attrs) skids))
           skids)] ; strip unknown tag (e.g. script), keep text kids
      [(list? x)
       (append* (map loop x))]
      [else '()])))

(define (parse-md s)
  (parse-markdown s))

(define (sanitize-xexpr x #:inline-only? [inline-only? #f])
  (define pieces (sanitize-pieces x #:inline-only? inline-only?))
  (match pieces
    [(list one) one]
    [many many]))

;; ---- markdown titles / notes ----------------------------------------------

(define (title-md-inline s)
  ;; Single-line parse; unwrap outer <p>; drop blocks; keep inlines.
  (define parsed (parse-md s))
  (define body
    (match parsed
      [(list (list 'p (list (list (? symbol?) _) ...) kids ...) _ ...) kids]
      [(list (list 'p kids ...) _ ...) kids]
      [other other]))
  (sanitize-pieces body #:inline-only? #t))

(define (add-tag-pills pieces)
  ;; Tag pills only in text nodes outside <code>. Code wins over #tags.
  (define re #px"#[A-Za-z0-9_-]+")
  (define (split-text s)
    (define parts '())
    (let loop ([pos 0])
      (define m (regexp-match-positions re s pos))
      (cond
        [(not m)
         (when (< pos (string-length s))
           (set! parts (cons (substring s pos) parts)))
         (reverse parts)]
        [else
         (define a (caar m))
         (define b (cdar m))
         (when (> a pos)
           (set! parts (cons (substring s pos a) parts)))
         (set! parts
               (cons
                `(span ((class "inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-100 text-xs px-2 py-0.5 font-medium font-mono"))
                       ,(substring s a b))
                parts))
         (loop b)])))
  (define (walk x #:in-code? [in-code? #f])
    (cond
      [(string? x)
       (if in-code? (list x) (split-text x))]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (xexpr-kids x))
       (define code? (or in-code? (eq? tag 'code)))
       (list (make-xexpr tag attrs
                         (append* (map (λ (k) (walk k #:in-code? code?)) kids))))]
      [(list? x)
       (append* (map (λ (k) (walk k #:in-code? in-code?)) x))]
      [else (list x)]))
  (append* (map walk pieces)))

(define (title->inline-xexprs title)
  (add-tag-pills (title-md-inline title)))

(define (style-md-xexpr x)
  (let loop ([x x])
    (cond
      [(string? x) x]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (map loop (xexpr-kids x)))
       (case tag
         [(code)
          (make-xexpr 'code
                      '((class "font-mono text-sm bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5"))
                      kids)]
         [(pre)
          (make-xexpr 'pre
                      '((class "font-mono text-sm bg-zinc-100 dark:bg-zinc-800 rounded p-3 overflow-x-auto my-2"))
                      kids)]
         [(a)
          (define href (cond [(assq 'href attrs) => cadr] [else "#"]))
          (make-xexpr 'a
                      `((href ,href)
                        (class "underline text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200"))
                      kids)]
         [(em)
          (make-xexpr 'em '((class "italic")) kids)]
         [(strong)
          (make-xexpr 'strong '((class "font-semibold")) kids)]
         [(p)
          (make-xexpr 'p
                      '((class "mt-1 text-sm text-zinc-500 dark:text-zinc-400"))
                      kids)]
         [else (make-xexpr tag attrs kids)])]
      [(list? x) (map loop x)]
      [else x])))

(define (note->xexprs note)
  (define parsed (parse-md note))
  (define pieces (sanitize-pieces parsed))
  (map style-md-xexpr pieces))

;; ---- tree chrome ----------------------------------------------------------

;; anchors: hash id -> task (for resolving mirror sites). May be #f / empty.
(define (child->xexpr x anchors #:today today)
  (cond
    [(mirror-ref? x)
     (mirror->xexpr (mirror-ref-anchor x) anchors #:today today)]
    [(task? x)
     (task->xexpr x anchors #:today today)]
    [else `(li "???")]))

(define (mirror->xexpr anchor anchors #:today today)
  (define target (and anchors (hash-ref anchors anchor #f)))
  (define link
    `(a ((href ,(string-append "#" anchor))
         (class "shrink-0 text-xs text-violet-600 dark:text-violet-400 hover:underline font-mono")
         (title ,(string-append "mirror of ^" anchor)))
        "↗" ,anchor))
  (cond
    [(not target)
     `(li ((class "list-disc ml-5 marker:text-violet-400"))
          (div ((class "flex items-baseline gap-2 text-zinc-500"))
               ,link
               (span ((class "text-sm")) "(unresolved)")))]
    [else
     ;; Render the target's body chrome with a mirror glyph; nest its children.
     (define inner (task->xexpr target anchors #:mirror-of anchor #:today today))
     inner]))

;; Bare ISO day title → friendly pill (display-only). ISO stays in the file.
(define (iso-day-title-xexpr iso-day today done?)
  (define label (friendly-date-label iso-day))
  (define today? (equal? iso-day today))
  (define base
    (if done?
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium line-through "
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium "))
  (define colors
    (cond
      [done?
       "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"]
      [today?
       "bg-sky-100 dark:bg-sky-900 text-sky-900 dark:text-sky-100 ring-2 ring-sky-400 dark:ring-sky-500"]
      [else
       "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"]))
  `(span ((class ,(string-append base colors))
          (title ,iso-day)
          ,@(if today? '((data-today "true")) '()))
         ,label))

(define (task->xexpr tk anchors #:mirror-of [mirror-of #f] #:today [today #f])
  (define title (task-title tk))
  (define date (task-date tk))
  (define desc (task-description tk))
  (define id (task-id tk))
  (define done? (and (task-done tk) #t))
  (define kids (task-children tk))
  (define today* (or today (today-iso-string)))
  (define iso-day (and (bare-iso-date-title? title) title))
  ;; Permalink target for calendar day cells: explicit ^id, else the ISO day.
  (define html-id
    (cond
      [mirror-of #f]
      [id id]
      [iso-day iso-day]
      [else #f]))
  (define title-class
    (if done?
        "text-base text-zinc-400 dark:text-zinc-500 line-through"
        "text-base text-zinc-900 dark:text-zinc-100"))
  (define checkbox
    (if done?
        `(span ((class "shrink-0 text-sm text-emerald-600 dark:text-emerald-400 select-none")
                (aria-hidden "true")
                (title "done"))
               "☑")
        `(span ((class "shrink-0 text-sm text-zinc-300 dark:text-zinc-600 select-none")
                (aria-hidden "true"))
               "☐")))
  (define mirror-glyph
    (if mirror-of
        `((a ((href ,(string-append "#" mirror-of))
              (class "shrink-0 text-xs text-violet-600 dark:text-violet-400 hover:underline font-mono")
              (title ,(string-append "mirror of ^" mirror-of)))
             "↗"))
        '()))
  (define title-el
    (if iso-day
        (iso-day-title-xexpr iso-day today* done?)
        `(span ((class ,title-class))
               ,@(map style-md-xexpr (title->inline-xexprs title)))))
  (define title-row
    `(div ((class "flex flex-wrap items-baseline gap-2 min-w-0"))
          ,checkbox
          ,@mirror-glyph
          ,title-el
          ,@(if date
                (list `(span ((class "text-xs rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-1.5 py-0.5 font-mono shrink-0"))
                             ,date))
                '())))
  (define desc-el
    (if desc
        `((div ((class ,(if done?
                            "mt-0.5 pl-1 opacity-60"
                            "mt-0.5 pl-1")))
               ,@(note->xexprs desc)))
        '()))
  (define body
    `(div ((class "py-0.5 min-w-0"))
          ,title-row
          ,@desc-el))
  (define li-attrs
    (append
     '((class "list-disc ml-5 marker:text-zinc-400 dark:marker:text-zinc-500"))
     (if html-id `((id ,html-id)) '())))
  (define li-attrs-parent
    (append
     '((class "list-none ml-1"))
     (if html-id `((id ,html-id)) '())))
  (if (null? kids)
      `(li ,li-attrs ,body)
      `(li ,li-attrs-parent
           (details ((class "group"))
                    (summary
                     ((class "cursor-pointer list-none flex items-start gap-1.5"))
                     (span ((class "mt-1.5 shrink-0 text-zinc-400 dark:text-zinc-500 select-none text-xs w-3 inline-block group-open:rotate-90 transition-transform"))
                           "▶")
                     (div ((class "min-w-0 flex-1"))
                          ,body))
                    (ul ((class "ml-3 pl-3 border-l border-zinc-200 dark:border-zinc-700 mt-0.5 space-y-0.5"))
                        ,@(map (λ (c) (child->xexpr c anchors #:today today*)) kids))))))

(define (cal-item-link it)
  (define id (cal-item-id it))
  (define title (cal-item-title it))
  (define done? (cal-item-done it))
  (define cls
    (if done?
        "block text-xs truncate text-zinc-400 dark:text-zinc-500 line-through"
        "block text-xs truncate text-zinc-700 dark:text-zinc-200 hover:underline"))
  (if id
      `(a ((href ,(string-append "#" id)) (class ,cls) (title ,(cal-item-breadcrumb it)))
          ,title)
      `(span ((class ,cls) (title ,(cal-item-breadcrumb it))) ,title)))

(define (month-grid-xexpr ym cal-hash today)
  (define cells (month-grid-cells ym cal-hash today))
  (define weeks
    (let loop ([cs cells] [acc '()])
      (if (null? cs)
          (reverse acc)
          (loop (drop cs 7) (cons (take cs 7) acc)))))
  `(div ((class "grid grid-cols-7 gap-1 text-sm"))
        ,@(for/list ([wd (in-list '("Mon" "Tue" "Wed" "Thu" "Fri" "Sat" "Sun"))])
            `(div ((class "text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 py-1"))
                  ,wd))
        ,@(append*
           (for/list ([week (in-list weeks)])
             (for/list ([cell (in-list week)])
               (if (not cell)
                   `(div ((class "min-h-[5.5rem] rounded-lg bg-zinc-100/50 dark:bg-zinc-900/40")))
                   (let* ([d (hash-ref cell 'date)]
                          [num (hash-ref cell 'day_num)]
                          [items (hash-ref cell 'items)]
                          [node? (hash-ref cell 'day_node)]
                          [today? (hash-ref cell 'is_today)]
                          [cell-cls
                           (string-append
                            "min-h-[5.5rem] rounded-lg border p-1.5 flex flex-col gap-0.5 "
                            (cond
                              [today?
                               "border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-950/40"]
                              [node?
                               "border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900"]
                              [else
                               "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"]))])
                     `(div ((class ,cell-cls))
                           (div ((class "flex items-baseline justify-between gap-1"))
                                ,(if node?
                                     `(a ((href ,(string-append "#" d))
                                          (class "font-semibold text-violet-700 dark:text-violet-300 hover:underline")
                                          (title ,(string-append "day notes " d)))
                                         ,(number->string num))
                                     `(span ((class "font-medium text-zinc-700 dark:text-zinc-200"))
                                            ,(number->string num)))
                                ,@(if today?
                                      `((span ((class "text-[10px] uppercase tracking-wide text-sky-600 dark:text-sky-400"))
                                              "today"))
                                      '()))
                           (div ((class "space-y-0.5 min-w-0"))
                                ,@(map cal-item-link (take items (min 4 (length items))))
                                ,@(if (> (length items) 4)
                                      `((span ((class "text-[10px] text-zinc-400"))
                                              ,(format "+~a more" (- (length items) 4))))
                                      '()))))))))))

(define calendar-nav-js
  #<<JS
(function(){
  var root=document.getElementById('sf-calendar');
  if(!root)return;
  var months=JSON.parse(root.getAttribute('data-months'));
  var i=1; // middle = current
  function show(){
    var panels=root.querySelectorAll('[data-cal-panel]');
    panels.forEach(function(p,idx){p.classList.toggle('hidden',idx!==i);});
    var title=root.querySelector('[data-cal-title]');
    if(title) title.textContent=months[i];
    var prev=root.querySelector('[data-cal-prev]');
    var next=root.querySelector('[data-cal-next]');
    if(prev) prev.disabled=i<=0;
    if(next) next.disabled=i>=months.length-1;
  }
  root.querySelector('[data-cal-prev]').addEventListener('click',function(){if(i>0){i--;show();}});
  root.querySelector('[data-cal-next]').addEventListener('click',function(){if(i<months.length-1){i++;show();}});
  show();
})();
JS
  )

(define (calendar-section-xexpr month-cals today)
  (define months (map (λ (c) (hash-ref c 'month)) month-cals))
  (define months-json
    (string-append "[\"" (string-join months "\",\"") "\"]"))
  `(section
    ((id "sf-calendar")
     (class "mb-10")
     (data-months ,months-json))
    (div ((class "flex items-center justify-between gap-3 mb-3"))
         (button ((type "button")
                  (data-cal-prev "")
                  (class "px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"))
                 "←")
         (h2 ((data-cal-title "")
              (class "text-lg font-semibold tracking-tight text-zinc-800 dark:text-zinc-100 font-mono"))
             ,(list-ref months (min 1 (sub1 (length months)))))
         (button ((type "button")
                  (data-cal-next "")
                  (class "px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"))
                 "→"))
    ,@(for/list ([cal (in-list month-cals)]
                 [idx (in-naturals)])
        (define ym (hash-ref cal 'month))
        `(div ((data-cal-panel ,ym)
               (class ,(if (= idx 1) "" "hidden")))
              ,(month-grid-xexpr ym cal today)))
    (script ,(cdata #f #f calendar-nav-js))))

;; sections: (listof (list section-title tasks anchors))
(define (page-xexpr sections page-title
                    #:today [today #f]
                    #:calendar-months [calendar-months #f])
  (define today* (or today (today-iso-string)))
  (define body-sections
    (match sections
      [(list (list _ tasks anchors))
       `((ul ((class "space-y-1"))
             ,@(map (λ (t) (task->xexpr t anchors #:today today*)) tasks)))]
      [many
       (append*
        (for/list ([sec (in-list many)])
          (define sec-title (car sec))
          (define tasks (cadr sec))
          (define anchors (caddr sec))
          `((section ((class "mb-8"))
                     (h2 ((class "text-lg font-semibold tracking-tight mb-3 text-zinc-800 dark:text-zinc-100"))
                         ,sec-title)
                     (ul ((class "space-y-1"))
                         ,@(map (λ (t) (task->xexpr t anchors #:today today*)) tasks))))))]))
  (define cal-sec
    (if (and calendar-months (pair? calendar-months))
        (list (calendar-section-xexpr calendar-months today*))
        '()))
  (define main-w
    (if (pair? cal-sec) "max-w-5xl mx-auto px-4 py-8" "max-w-2xl mx-auto px-4 py-8"))
  `(html ((lang "en"))
         (head
          (meta ((charset "utf-8")))
          (meta ((name "viewport") (content "width=device-width, initial-scale=1")))
          (title ,page-title)
          (script ((src "https://cdn.tailwindcss.com")))
          (script "tailwind.config = { darkMode: 'media' }")
          (style "summary{outline:none;list-style:none} summary::-webkit-details-marker{display:none}"))
         (body ((class "bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen"))
               (main ((class ,main-w))
                     (header ((class "mb-6"))
                             (h1 ((class "text-xl font-semibold tracking-tight"))
                                 ,page-title))
                     ,@cal-sec
                     ,@body-sections))))

(define (tasks->html tasks page-title #:anchors [anchors #f] #:today [today #f] #:month [month #f])
  (files->html (list (list page-title tasks (or anchors (hash))))
               page-title
               #:today today
               #:month month))

;; file-entries: (listof (list path-or-label tasks anchors))
;;   or legacy (cons path tasks) with empty anchors
(define (files->html file-entries page-title #:today [today #f] #:month [month #f])
  (define today* (or today (today-iso-string)))
  (define sections
    (for/list ([e (in-list file-entries)])
      (define-values (label tasks anchors)
        (match e
          [(list p t a) (values p t a)]
          [(cons p t) (values p t (hash))]
          [_ (error 'files->html "bad entry")]))
      (define lab
        (let ([p label])
          (if (path? p)
              (path->string (file-name-from-path p))
              (let ([s (if (string? p) p (format "~a" p))])
                (define-values (base name dir?) (split-path s))
                (if (path-for-some-system? name)
                    (path->string name)
                    s)))))
      (list lab tasks (or anchors (hash)))))
  (define pairs
    (for/list ([sec (in-list sections)])
      (cons (car sec) (cadr sec))))
  (define ym
    (or month (substring today* 0 7)))
  (define month-cals
    (for/list ([delta (in-list '(-1 0 1))])
      (calendar-from-files pairs (shift-year-month ym delta))))
  (string-append
   "<!DOCTYPE html>\n"
   (xexpr->string (page-xexpr sections page-title
                              #:today today*
                              #:calendar-months month-cals))))
