/**
 * Moved from chat when journal became a second consumer. The alerts row
 * owns the channel; consumers acquire alerts.channel on their components.
 *
 * Persisted key compatibility for the browser test surface. Runtime state and
 * observers belong to the alerts row's independently scoped channel provider.
 */
export const ALERTS_KEY = "olai.alerts"
export const ALERT_SOUND_KEY = "olai.alerts.sound"
