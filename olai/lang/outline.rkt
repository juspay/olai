#lang racket/base

;; Line-oriented outline parser for #lang olai.
;; Emits (t "title" #:id ... #:date ... #:description ... #:done ... child ...)
;; and (mirror "anchor") with srclocs.

(require racket/list
         racket/match
         racket/string
         syntax/readerr
         olai/lang/line)

;; The line grammar itself lives in lang/line.rkt; these two are re-exported
;; because they are how a title's sugar is spelled everywhere.
(provide parse-outline-port
         parse-outline-string
         strip-checkbox-prefix
         strip-trailing-anchor)

(struct raw-line (n col text indent content) #:transparent)

;; descs: list of (list text line col) newest-first
;; date-info / done-info / doing-info: #f or (list value line col)
;; id-info: #f or (list id-string line col)
;; mirror-anchor: #f or anchor string (when set, this node is a mirror leaf)
;; include-path: #f or relative path string (when set, this node is an include leaf)
(struct node (title date-info done-info doing-info id-info descs children
              line col span src mirror-anchor include-path)
  #:mutable #:transparent)

(define (reader-error src line col pos msg . args)
  (raise-read-error
   (if (null? args) msg (apply format msg args))
   src line col pos #f))

(define (count-indent s src line)
  (define len (string-length s))
  (let loop ([i 0])
    (cond
      [(>= i len) (values i "" i)]
      [(char=? (string-ref s i) #\tab)
       (reader-error src line i #f
                     "tabs are not allowed in indentation; use spaces (2 per level)")]
      [(char=? (string-ref s i) #\space)
       (loop (add1 i))]
      [else (values i (substring s i) i)])))

(define (read-raw-lines src in)
  (define lines '())
  (let loop ([n 1])
    (define s (read-line in 'any))
    (cond
      [(eof-object? s) (reverse lines)]
      [else
       (define-values (ind content col) (count-indent s src n))
       (set! lines (cons (raw-line n col s ind content) lines))
       (loop (add1 n))])))

;; The grammar says what a line IS (lang/line.rkt); the reader is what says
;; where it went wrong. This is the whole difference between the two.
(define (classify-content content src line col)
  ;; The reader is handed the body AFTER the #lang line, so a line that looks
  ;; like one here is an ordinary title.
  (define classified (classify-line content))
  (define k
    (if (line-lang? classified) (list 'title content #f #f) classified))
  (match k
    [(list 'meta 'bad msg)
     (reader-error src line col #f "~a" msg)]
    [(list 'title "" _ (? string? anchor))
     (reader-error src line col #f "title required before ^~a" anchor)]
    [_ k]))

(define (level-of indent src line col)
  (unless (zero? (remainder indent 2))
    (reader-error src line col #f
                  "indentation must be a multiple of 2 spaces (got ~a)"
                  indent))
  (quotient indent 2))

(define (loc-vec src line col span)
  (vector src line col #f span))

;; @done and @doing are the same shape — a keyword, optionally followed by a
;; timestamp — so they are spelled once. The keyword's srcloc spans the
;; "@name" the source wrote, which is what an error about it underlines. The
;; no-mark case comes first: it is most nodes, and it costs nothing.
(define (mark-part src kw info)
  (match info
    [#f '()]
    [(list v line col)
     (define kw-stx
       (datum->syntax #f kw
                      (loc-vec src line col
                               (add1 (string-length (keyword->string kw))))))
     (if (eq? v #t)
         (list kw-stx)
         (list kw-stx (datum->syntax #f v (loc-vec src line col
                                                   (string-length v)))))]))

;; descs is newest-first, so the OLDEST is the run's first line — the one the
;; joined text is blamed on. Empty descs means the node wrote no `:` line.
(define (description-part src descs)
  (match (reverse descs)
    ['() '()]
    [(and texts (cons (list _ dline dcol) _))
     (define joined (string-join (map car texts) "\n"))
     (list (datum->syntax #f '#:description (loc-vec src dline dcol 1))
           (datum->syntax #f joined
                          (loc-vec src dline dcol (string-length joined))))]))

(define (node-mirror? nd)
  (and (node-mirror-anchor nd) #t))

(define (node-include? nd)
  (and (node-include-path nd) #t))

(define (node->syntax nd)
  (define src (node-src nd))
  (define line (node-line nd))
  (define col (node-col nd))
  (define span (node-span nd))
  (cond
    [(node-mirror? nd)
     (define a (node-mirror-anchor nd))
     (datum->syntax
      #f
      (list (datum->syntax #f 'mirror (loc-vec src line col span))
            (datum->syntax #f a (loc-vec src line col (string-length a))))
      (loc-vec src line col span))]
    [(node-include? nd)
     (define p (node-include-path nd))
     (datum->syntax
      #f
      (list (datum->syntax #f 'include (loc-vec src line col span))
            (datum->syntax #f p (loc-vec src line col (string-length p))))
      (loc-vec src line col span))]
    [else
     (define title-stx
       (datum->syntax #f (node-title nd) (loc-vec src line col span)))
     (define id-part
       (match (node-id-info nd)
         [(list id iline icol)
          (list (datum->syntax #f '#:id (loc-vec src iline icol 3))
                (datum->syntax #f id (loc-vec src iline icol (string-length id))))]
         [#f '()]))
     (define date-part
       (match (node-date-info nd)
         [(list d dline dcol)
          (list (datum->syntax #f '#:date (loc-vec src dline dcol 5))
                (datum->syntax #f d (loc-vec src dline dcol (string-length d))))]
         [#f '()]))
     (define done-part (mark-part src '#:done (node-done-info nd)))
     (define doing-part (mark-part src '#:doing (node-doing-info nd)))
     (define desc-part (description-part src (node-descs nd)))
     (define kids (map node->syntax (reverse (node-children nd))))
     (define form
       (cons (datum->syntax #f 't (loc-vec src line col span))
             (append (list title-stx) id-part date-part done-part doing-part
                     desc-part kids)))
     (datum->syntax #f form (loc-vec src line col span))]))

(define (parse-lines src lines)
  (define roots '())
  (define stack '())

  (define (current-depth) (length stack))

  (define (last-node-at level)
    (and (< level (length stack))
         (list-ref stack level)))

  (define (push-node! nd level)
    (when (> level 0)
      (define parent (list-ref stack (sub1 level)))
      (when (node-mirror? parent)
        (reader-error src (node-line nd) (node-col nd) #f
                      "mirror cannot have children"))
      (when (node-include? parent)
        (reader-error src (node-line nd) (node-col nd) #f
                      "include cannot have children"))
      (set-node-children! parent (cons nd (node-children parent))))
    (when (zero? level)
      (set! roots (cons nd roots)))
    (set! stack (append (take stack level) (list nd))))

  ;; Every node kind runs the same two checks before it is pushed, and used to
  ;; say so three times over: an indent may not skip a level, and a mirror or
  ;; an include is a leaf.
  (define (check-level! level n col)
    (when (> level (current-depth))
      (reader-error src n col #f
                    (string-append "indent jumps more than one level "
                                   "(from ~a to ~a); use 2 spaces per level")
                    (current-depth) level))
    (when (and (zero? (current-depth)) (positive? level))
      (reader-error src n col #f
                    (string-append "indent jumps more than one level "
                                   "(from 0 to ~a); top-level tasks must "
                                   "start at column 0")
                    level)))

  (define (check-leaf-parent! level n col)
    (define parent (and (positive? level) (last-node-at (sub1 level))))
    (when parent
      (when (node-mirror? parent)
        (reader-error src n col #f "mirror cannot have children"))
      (when (node-include? parent)
        (reader-error src n col #f "include cannot have children"))))

  (define (require-task-parent! level n col what)
    (when (zero? level)
      (reader-error src n col #f "~a with no title above" what))
    (define parent (last-node-at (sub1 level)))
    (unless parent
      (reader-error src n col #f "~a with no title above" what))
    (when (node-mirror? parent)
      (reader-error src n col #f "~a cannot attach to a mirror" what))
    (when (node-include? parent)
      (reader-error src n col #f "~a cannot attach to an include" what))
    parent)

  (for ([rl (in-list lines)])
    (define n (raw-line-n rl))
    (define col (raw-line-col rl))
    (define ind (raw-line-indent rl))
    (define content (raw-line-content rl))
    (define kind (classify-content content src n col))
    (cond
      [(line-blank? kind) (void)]
      [else
       (define level (level-of ind src n col))
       (match kind
         [`(mirror ,anchor)
          (check-level! level n col)
          (check-leaf-parent! level n col)
          (set! stack (take stack level))
          (define nd
            (node #f #f #f #f #f '() '() n col (string-length content) src anchor #f))
          (push-node! nd level)]
         [`(include ,path)
          (check-level! level n col)
          (check-leaf-parent! level n col)
          (set! stack (take stack level))
          (define nd
            (node #f #f #f #f #f '() '() n col (string-length content) src #f path))
          (push-node! nd level)]
         [`(title ,title ,flag ,anchor)
          (check-level! level n col)
          (set! stack (take stack level))
          ;; the checkbox IS the node's mark, so `[x] X` plus `@done` below it
          ;; is a duplicate, exactly as two `@done` lines would be
          (define done-info (and (eq? flag 'done) (list #t n col)))
          (define doing-info (and (eq? flag 'doing) (list #t n col)))
          (define id-info
            (and anchor (list anchor n col)))
          (define nd
            (node title #f done-info doing-info id-info '() '() n col
                  (string-length title) src #f #f))
          (push-node! nd level)]
         [`(meta desc ,text)
          (define parent (require-task-parent! level n col "description line"))
          (set-node-descs! parent (cons (list text n col) (node-descs parent)))]
         [`(meta date ,d ,off)
          (define parent (require-task-parent! level n col "@date"))
          (when (node-date-info parent)
            (reader-error src n col #f
                          "duplicate @date on this task"))
          (set-node-date-info! parent (list d n (+ col off)))]
         [`(meta done ,d ,off)
          (define parent (require-task-parent! level n col "@done"))
          (when (node-done-info parent)
            (reader-error src n col #f
                          "duplicate @done on this task"))
          (set-node-done-info! parent (list d n (+ col off)))]
         ;; A node that is both done and doing is a LANGUAGE error, not a
         ;; reader one — the reader only knows that neither field is here
         ;; twice. The expander is what rejects the pair (lang/expander).
         [`(meta doing ,d ,off)
          (define parent (require-task-parent! level n col "@doing"))
          (when (node-doing-info parent)
            (reader-error src n col #f
                          "duplicate @doing on this task"))
          (set-node-doing-info! parent (list d n (+ col off)))])]))
  (map node->syntax (reverse roots)))

(define (parse-outline-port src in)
  (parse-lines src (read-raw-lines src in)))

(define (parse-outline-string src str)
  (define in (open-input-string str))
  (port-count-lines! in)
  (parse-outline-port src in))
