import type { Page } from "playwright";

export const ALERTS = "__olaiAlerts";

export interface Banner {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
}

export interface Alerts {
  readonly banners: ReadonlyArray<Banner>;
  readonly notes: number;
}

export type Consent = "granted" | "denied";

/**
 * Headless Chromium hard-wires `Notification.permission` to `denied` whatever
 * `grantPermissions(["notifications"])` says, because it has no notification UI
 * at all, and that field is what the app reads before delivering.
 *
 * Playwright ships this to the browser as source, so it closes over nothing and
 * takes its parameters as one argument.
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
    return Promise.resolve();
  };

  const oscillator = OscillatorNode.prototype as unknown as {
    start: (when?: number) => void;
  };
  const started = oscillator.start;
  oscillator.start = function (this: OscillatorNode, when?: number): void {
    held.notes += 1;
    started.call(this, when);
  };
};

export const alertsOn = (page: Page): Promise<Alerts> =>
  page.evaluate<Alerts, string>(
    (key) =>
      ((globalThis as unknown as Record<string, unknown>)[key] as Alerts | undefined) ??
      { banners: [], notes: 0 },
    ALERTS,
  );
