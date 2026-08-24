/**
 * WHAT THE APP ASKED THE MACHINE FOR when the agent stopped on somebody: the
 * notification, and the chime.
 *
 * Both leave the browser, and neither becomes a DOM node. An OS banner is
 * drawn by the desktop's own daemon and Playwright can neither see one nor
 * press one; a chime is a pressure wave into a sound card a headless stage
 * does not have. So the two calls that produce them are wrapped in every
 * document of an `@alerts` context, and what they were asked for is kept.
 *
 * Everything under the wrapper is real: a real `/sw.js` registered by the real
 * boot, a real granted (or refused) permission, the framework's real seam
 * deciding whether there is an active worker to deliver through, and the real
 * `AudioContext` the chime opens on the first gesture. What is faked is the
 * last inch of each — the part whose whole effect is outside the browser — and
 * what a scenario then asserts is exactly what this app owns: the sentence,
 * the dedup tag, that a banner was raised at all, and that a sound was.
 *
 * THE PERMISSION IS THE SUBTLE ONE. `grantPermissions(["notifications"])` is
 * real and takes: `navigator.permissions.query({name:"notifications"})`
 * answers `granted` afterwards. But headless Chromium hard-wires
 * `Notification.permission` to `denied` whatever the grant says, because a
 * headless browser has no notification UI at all — and `Notification.permission`
 * is the field both this app and the framework's seam read before delivering.
 * Left alone, every scenario here would pass by never reaching the code it is
 * about. So the static is made to say what the context was actually set up
 * with: `granted` where the permission was granted, `denied` where a scenario
 * is about a browser that has refused (`@alerts-denied`). What is simulated is
 * a browser with notifications, never a permission nobody gave.
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
export const ALERTS = "__olaiAlerts";

/** One raised notification, as the app asked for it. */
export interface Banner {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
}

/** What an `@alerts` document recorded. */
export interface Alerts {
  readonly banners: ReadonlyArray<Banner>;
  /** How many oscillators the chime opened. Two per ring (`chime.ts` plays a
   *  fifth), so what a scenario may say is that one RANG or that none did —
   *  never how many, which is a fact about the sound rather than about the
   *  alert. */
  readonly notes: number;
}

/** What the browser should say when the app asks whether it may draw one. */
export type Consent = "granted" | "denied";

/**
 * The init script: say what the context was set up with, wrap the two calls,
 * and keep what they were asked for.
 *
 * SELF-CONTAINED, because Playwright ships this to the browser as source — it
 * closes over nothing, and takes its two parameters as one argument.
 */
export const recordAlerts = (asked: { key: string; consent: Consent }): void => {
  const held: { banners: Array<Banner>; notes: number } = { banners: [], notes: 0 };
  (globalThis as unknown as Record<string, unknown>)[asked.key] = held;

  Object.defineProperty(Notification, "permission", {
    get: () => asked.consent,
    configurable: true,
  });

  const registration = ServiceWorkerRegistration.prototype as unknown as {
    showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  };
  registration.showNotification = function (
    title: string,
    options?: NotificationOptions,
  ): Promise<void> {
    held.banners.push({ title, body: options?.body ?? "", tag: options?.tag ?? "" });
    // The real call is deliberately NOT made. A headless browser has nowhere
    // to draw one, and what it would answer with — a rejection this app is
    // written to swallow — is indistinguishable from never having been asked.
    // What is under test is the ask.
    return Promise.resolve();
  };

  // The chime, at the ONE call that makes a sound. Wrapping `createOscillator`
  // rather than `AudioContext` itself keeps the context real: whether this
  // browser will open one, and whether the first gesture unlocked it, is
  // exactly what the module is careful about and must not be faked away.
  const oscillator = OscillatorNode.prototype as unknown as {
    start: (when?: number) => void;
  };
  const started = oscillator.start;
  oscillator.start = function (this: OscillatorNode, when?: number): void {
    held.notes += 1;
    // ... and this one IS made. A note into a null sink costs nothing and
    // leaves the graph the module built running the way it really runs.
    started.call(this, when);
  };
};

/** What this document has asked the machine for, so far. */
export const alertsOn = (page: Page): Promise<Alerts> =>
  page.evaluate<Alerts, string>(
    (key) =>
      ((globalThis as unknown as Record<string, unknown>)[key] as Alerts | undefined) ??
      { banners: [], notes: 0 },
    ALERTS,
  );
