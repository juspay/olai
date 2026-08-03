#lang racket/base

;; Public library surface: task data model, agenda query, HTML render.
;; CLI is app code, not re-exported here.

(require (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/agenda
         selfflowy/html)

(provide task
         task?
         task-title
         task-date
         task-description
         task-done
         task-tags
         task-children
         title-tags
         (struct-out dated-task)
         collect-dated
         agenda-groups
         agenda-groups-from-files
         tasks->html
         files->html)
