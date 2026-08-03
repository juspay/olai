#lang racket/base

;; Interactive HTML outline as a tree: nested lists + native <details>.
;; Titles/notes via markdown package → xexprs. No ANSI. Click a node to
;; expand/collapse (no expand-all chrome).

(require racket/list
         racket/match
         racket/string
         xml
         (only-in markdown parse-markdown)
         (except-in selfflowy/lang/expander #%module-begin))

(provide tasks->html
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

;; Returns a list of sanitized pieces (may flatten forbidden wrappers).
(define (sanitize-pieces x #:inline-only? [inline-only? #f])
  (define (allowed? tag)
    (or (hash-ref allowed-inline tag #f)
        (and (not inline-only?) (hash-ref allowed-block tag #f))))
  (let loop ([x x])
    (cond
      [(string? x) (list x)]
      [(symbol? x) (list (symbol->string x))]
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

(define (sanitize-xexpr x #:inline-only? [inline-only? #f])
  (define pieces (sanitize-pieces x #:inline-only? inline-only?))
  (match pieces
    [(list one) one]
    [many many]))

;; ---- markdown titles / notes ----------------------------------------------

(define (title-md-inline s)
  ;; Single-line parse; unwrap outer <p>; drop blocks; keep inlines.
  (define parsed (parse-markdown s))
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
  (define parsed (parse-markdown note))
  (define pieces (sanitize-pieces parsed))
  (map style-md-xexpr pieces))

;; ---- tree chrome ----------------------------------------------------------

(define (task->xexpr tk)
  (define title (task-title tk))
  (define date (task-date tk))
  (define desc (task-description tk))
  (define done? (and (task-done tk) #t))
  (define kids (task-children tk))
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
  (define title-row
    `(div ((class "flex flex-wrap items-baseline gap-2 min-w-0"))
          ,checkbox
          (span ((class ,title-class))
                ,@(map style-md-xexpr (title->inline-xexprs title)))
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
  (if (null? kids)
      `(li ((class "list-disc ml-5 marker:text-zinc-400 dark:marker:text-zinc-500"))
           ,body)
      `(li ((class "list-none ml-1"))
           (details ((class "group"))
                    (summary
                     ((class "cursor-pointer list-none flex items-start gap-1.5"))
                     (span ((class "mt-1.5 shrink-0 text-zinc-400 dark:text-zinc-500 select-none text-xs w-3 inline-block group-open:rotate-90 transition-transform"))
                           "▶")
                     (div ((class "min-w-0 flex-1"))
                          ,body))
                    (ul ((class "ml-3 pl-3 border-l border-zinc-200 dark:border-zinc-700 mt-0.5 space-y-0.5"))
                        ,@(map task->xexpr kids))))))

(define (page-xexpr tasks page-title)
  `(html ((lang "en"))
         (head
          (meta ((charset "utf-8")))
          (meta ((name "viewport") (content "width=device-width, initial-scale=1")))
          (title ,page-title)
          (script ((src "https://cdn.tailwindcss.com")))
          (script "tailwind.config = { darkMode: 'media' }")
          (style "summary{outline:none;list-style:none} summary::-webkit-details-marker{display:none}"))
         (body ((class "bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen"))
               (main ((class "max-w-2xl mx-auto px-4 py-8"))
                     (header ((class "mb-6"))
                             (h1 ((class "text-xl font-semibold tracking-tight"))
                                 ,page-title))
                     (ul ((class "space-y-1"))
                         ,@(map task->xexpr tasks))))))

(define (tasks->html tasks page-title)
  (string-append
   "<!DOCTYPE html>\n"
   (xexpr->string (page-xexpr tasks page-title))))
