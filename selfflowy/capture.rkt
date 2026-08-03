#lang racket/base

;; Append a capture task under Inbox in an outline (#lang selfflowy) file.
;; Preserves existing content; only inserts new lines at a computed position.

(require racket/list
         racket/match
         racket/path
         racket/port
         racket/string)

(provide format-capture-lines
         find-inbox-insert
         append-capture
         try-git-commit)

;; Lines to insert for a new task under Inbox (indent level 1).
(define (format-capture-lines title #:date [date #f] #:description [desc #f])
  (define head (string-append "  " title))
  (define meta
    (append
     (if desc (list (string-append "    : " desc)) '())
     (if date (list (string-append "    @date " date)) '())))
  (cons head meta))

(define (scan-line s)
  (cond
    [(regexp-match? #px"^\\s*$" s) 'blank]
    [(regexp-match? #px"^#lang\\s" s) 'lang]
    [else
     (define m (regexp-match #px"^( *)(.*)$" s))
     (define ind (string-length (cadr m)))
     (define content (caddr m))
     (define level (quotient ind 2))
     (cond
       [(and (zero? level)
             (not (regexp-match? #px"^:" content))
             (not (regexp-match? #px"^@" content)))
        (define title
          (if (regexp-match? #px"^\\\\" content)
              (substring content 1)
              content))
        (list 'title 0 title)]
       [else (list 'other level content)])]))

;; Returns (values insert-pos has-inbox? task-line-1-based)
(define (find-inbox-insert text)
  (define lines (string-split text "\n" #:trim? #f))
  ;; Drop trailing empty from split quirk only when text ends with \n?
  ;; string-split "a\n" -> ("a" "") — keep it for offset math
  (define-values (inbox-line end-line)
    (let loop ([i 0] [inbox #f] [seen? #f])
      (cond
        [(>= i (length lines))
         (values inbox (length lines))]
        [else
         (match (scan-line (list-ref lines i))
           [(list 'title 0 title)
            (cond
              [(and (not seen?) (equal? title "Inbox"))
               (loop (add1 i) i #t)]
              [seen?
               (values inbox i)]
              [else
               (loop (add1 i) inbox seen?)])]
           [_ (loop (add1 i) inbox seen?)])])))
  ;; Insert after the last non-blank line of the Inbox section (before
  ;; trailing blanks that precede the next top-level title).
  (define insert-line
    (let loop ([e end-line])
      (cond
        [(or (not inbox-line) (<= e (add1 inbox-line))) e]
        [(eq? (scan-line (list-ref lines (sub1 e))) 'blank)
         (loop (sub1 e))]
        [else e])))
  (define (line-start-offset line-idx)
    (for/sum ([j (in-range line-idx)])
      ;; +1 for the newline after each prior line
      (add1 (string-length (list-ref lines j)))))
  (cond
    [(not inbox-line)
     (values (string-length text) #f
             (add1 (length (filter (λ (s) (not (string=? s ""))) lines))))]
    [else
     (values (line-start-offset insert-line) #t (add1 insert-line))]))

(define (ensure-nl s)
  (if (or (string=? s "") (regexp-match? #px"\n$" s)) s (string-append s "\n")))

;; -> (values new-text task-line-number created-inbox?)
(define (append-capture text title #:date [date #f] #:description [desc #f])
  (define-values (pos has-inbox? line-no) (find-inbox-insert text))
  (define body-lines (format-capture-lines title #:date date #:description desc))
  (define block
    (if has-inbox?
        (string-append (string-join body-lines "\n") "\n")
        (string-append "Inbox\n" (string-join body-lines "\n") "\n")))
  (define prefix (substring text 0 pos))
  (define suffix (substring text pos))
  (define new-text
    (if has-inbox?
        (string-append (if (string=? prefix "") "" (ensure-nl prefix))
                       block
                       suffix)
        (string-append (if (string=? text "") "" (ensure-nl text))
                       block)))
  (define actual-line
    (if has-inbox?
        line-no
        (let* ([base-text (if (string=? text "") "" (ensure-nl text))]
               [n (length (string-split base-text "\n" #:trim? #f))]
               ;; string-split "x\n" gives ("x" ""); count non-final empties carefully
               [lines (string-split base-text "\n" #:trim? #f)]
               [line-count (if (and (pair? lines) (string=? (last lines) ""))
                               (sub1 (length lines))
                               (length lines))])
          ;; Inbox on next line, task on the one after
          (+ line-count 2))))
  (values new-text actual-line (not has-inbox?)))

(define (try-git-commit file-path message)
  (define dir (path-only (path->complete-path file-path)))
  (define git (find-executable-path "git"))
  (cond
    [(not git) #f]
    [else
     (define (git-run . args)
       (define-values (sp out in err)
         (apply subprocess #f #f #f git args))
       (close-output-port in)
       (define _o (port->string out))
       (define _e (port->string err))
       (close-input-port out)
       (close-input-port err)
       (subprocess-wait sp)
       (subprocess-status sp))
     (define-values (sp out in err)
       (subprocess #f #f #f git "-C" (path->string dir)
                   "rev-parse" "--show-toplevel"))
     (close-output-port in)
     (define top (string-trim (port->string out)))
     (close-input-port out)
     (close-input-port err)
     (subprocess-wait sp)
     (cond
       [(not (zero? (subprocess-status sp))) #f]
       [else
        (define full (path->string (path->complete-path file-path)))
        (and (zero? (git-run "-C" (path->string dir) "add" "--" full))
             (zero? (git-run "-C" (path->string dir) "commit" "-m" message
                             "--" full)))])]))
