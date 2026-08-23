/**
 * What the app asked the service worker to SHOW.
 *
 * An OS notification is drawn outside the browser: Playwright can neither see
 * one nor press one, and there is no headless mode in which it becomes a DOM
 * node. So the one call that produces one — `registration.showNotification`,
 * which is the ONLY notification path that works in an installed PWA and the
 * reason olai serves a worker at all — is wrapped in every document of an
 * `@alerts` context, and what it was asked for is kept.
 *
 * Everything under the wrapper is real: a real `/sw.js` registered by the real
 * boot, a real granted permission, and the framework's real seam deciding
 * whether there is an active worker to deliver through. What is faked is one
 * platform method whose whole effect leaves the browser — and what a scenario
 * then asserts is exactly what this app owns: the sentence, the dedup tag, and
 * that a banner was raised at all.
 *
 * `page.evaluate` is what reads it back rather than an exposed binding: the
 * record belongs to the DOCUMENT — a reload starts a fresh one, which is what
 * a reload does to a page's notifications too — and a binding would quietly
 * make it survive one.
 */

import type { Page } from "playwright";

/** Where the record lives on `window`. Namespaced so nothing this app or the
 *  framework does can collide with it, and PASSED to the init script rather
 *  than spelled inside it, so there is one spelling and not two. */
export const BANNERS = "__olaiBanners";

/** One raised banner, as the app asked for it. */
export interface Banner {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
}

/**
 * The init script: report the permission the context was granted, wrap
 * `showNotification`, and keep what it was called with.
 *
 * SELF-CONTAINED, because Playwright ships this to the browser as source — it
 * closes over nothing, and takes the global's name as its argument.
 *
 * THE PERMISSION IS THE SUBTLE HALF. `grantPermissions(["notifications"])` is
 * real and takes: `navigator.permissions.query({name:"notifications"})`
 * answers `granted` afterwards. But headless Chromium hard-wires
 * `Notification.permission` to `denied` whatever the grant says, because a
 * headless browser has no notification UI at all — and `Notification.permission`
 * is the field both this app and the framework's seam read before delivering.
 * Left alone, every scenario here would pass by never reaching the code it is
 * about. So the static is made to agree with the Permissions API the context
 * actually granted: what is simulated is a browser with notifications, not a
 * permission nobody gave.
 */
export const recordBanners = (key: string): void => {
  const held: Array<{ title: string; body: string; tag: string }> = [];
  (globalThis as unknown as Record<string, unknown>)[key] = held;
  Object.defineProperty(Notification, "permission", {
    get: () => "granted",
    configurable: true,
  });
  const proto = ServiceWorkerRegistration.prototype as unknown as {
    showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  };
  proto.showNotification = function (
    title: string,
    options?: NotificationOptions,
  ): Promise<void> {
    held.push({ title, body: options?.body ?? "", tag: options?.tag ?? "" });
    // The real call is deliberately NOT made. A headless browser has nowhere
    // to draw one, and what it would answer with — a rejection this app is
    // written to swallow — is indistinguishable from never having been asked.
    // What is under test is the ask.
    return Promise.resolve();
  };
};

/** Every banner this document has raised, oldest first. */
export const bannersOn = (page: Page): Promise<ReadonlyArray<Banner>> =>
  page.evaluate<ReadonlyArray<Banner>, string>(
    (key) =>
      ((globalThis as unknown as Record<string, unknown>)[key] as
        | ReadonlyArray<Banner>
        | undefined) ?? [],
    BANNERS,
  );
