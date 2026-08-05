#lang racket/base

;; Public library surface: task data model, agenda query, web renderers.
;; CLI is app code, not re-exported here.

(require (except-in selfflowy/lang/expander #%module-begin)
         (only-in selfflowy/lang/walk find-task-by-id find-tasks-by-title)
         selfflowy/agenda
         selfflowy/web/render)

(provide task
         make-task
         task?
         task-title
         task-date
         task-description
         task-done
         task-status
         task-done-at
         task-id
         task-tags
         task-children
         task-file
         task-key
         mirror-ref
         mirror-ref?
         mirror-ref-anchor
         title-tags
         valid-anchor-id?
         find-task-by-id
         find-tasks-by-title
         validate-task-tree!
         (struct-out dated-task)
         collect-dated
         agenda-groups
         agenda-groups-from-files
         render-node-fragment
         render-outline
         render-breadcrumbs
         render-sidebar
         render-page
         render-zoom)
