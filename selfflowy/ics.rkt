#lang racket/base

;; Minimal RFC 5545 VCALENDAR writer.
;; No maintained ics library found on the Racket package catalog (checked
;; via raco pkg catalog-show ics / icalendar); a thin writer is justified.

(require racket/list
         racket/path
         racket/string
         file/sha1
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/calendar
         selfflowy/dates
         (only-in selfflowy/paths file-label))

(provide tasks->ics
         ics-escape
         cal-items->ics)

(define (ics-escape s)
  (define s1 (string-replace (or s "") "\\" "\\\\"))
  (define s2 (string-replace s1 ";" "\\;"))
  (define s3 (string-replace s2 "," "\\,"))
  (string-replace s3 "\n" "\\n"))

(define (fold-ics-line s)
  (if (<= (string-length s) 75)
      s
      (let loop ([rest s] [acc '()])
        (if (<= (string-length rest) 75)
            (string-join (reverse (cons rest acc)) "\r\n ")
            (loop (substring rest 75)
                  (cons (substring rest 0 75) acc))))))

(define (dt-value iso)
  (define n (normalize-date-string iso))
  (cond
    [(regexp-match #px"^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?" n)
     => (λ (m)
          (format "~a~a~aT~a~a~a"
                  (cadr m) (caddr m) (cadddr m)
                  (list-ref m 4) (list-ref m 5)
                  (or (list-ref m 6) "00")))]
    [(regexp-match #px"^([0-9]{4})-([0-9]{2})-([0-9]{2})$" n)
     => (λ (m) (format "~a~a~a" (cadr m) (caddr m) (cadddr m)))]
    [else n]))

(define (uid-for path title date id)
  (define base
    (or id
        (bytes->hex-string
         (sha1-bytes (string->bytes/utf-8
                      (format "~a\0~a\0~a" path title date))))))
  (format "~a@selfflowy" base))

(define (vevent path-str it)
  (define date (cal-item-date it))
  (define title (cal-item-title it))
  (define n (normalize-date-string date))
  (define date-only? (regexp-match? #px"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" n))
  (define dt
    (if date-only?
        (format "DTSTART;VALUE=DATE:~a" (dt-value n))
        (format "DTSTART:~a" (dt-value n))))
  (define desc-parts
    (filter non-empty-string?
            (list (cal-item-breadcrumb it)
                  (if (cal-item-done it)
                      (format "done: ~a" (cal-item-done it))
                      ""))))
  (define lines
    (list "BEGIN:VEVENT"
          (format "UID:~a" (uid-for path-str title date (cal-item-id it)))
          dt
          (format "SUMMARY:~a" (ics-escape title))
          (format "DESCRIPTION:~a" (ics-escape (string-join desc-parts "\n")))
          "END:VEVENT"))
  (map fold-ics-line lines))

;; The VCALENDAR wrapper, written once. `events` is the already-folded lines
;; of every VEVENT.
(define (vcalendar events)
  (string-append
   "BEGIN:VCALENDAR\r\n"
   "VERSION:2.0\r\n"
   "PRODID:-//selfflowy//EN\r\n"
   "CALSCALE:GREGORIAN\r\n"
   (string-join events "\r\n")
   (if (null? events) "" "\r\n")
   "END:VCALENDAR\r\n"))

(define (path-string p)
  (if (path? p) (path->string p) (format "~a" p)))

;; file-entries: (listof (cons path tasks))
(define (tasks->ics file-entries)
  (vcalendar
   (append*
    (for/list ([e (in-list file-entries)])
      (define path (car e))
      ;; ICS events are read outside the outline, so every breadcrumb is
      ;; file-rooted here, single file or not.
      (append*
       (for/list ([it (in-list (collect-cal-items (cdr e)
                                                  #:root (file-label path)))])
         (vevent (path-string path) it)))))))

(define (cal-items->ics items #:path [path "outline.rkt"])
  (vcalendar
   (append*
    (for/list ([it (in-list items)])
      (vevent (path-string path) it)))))
