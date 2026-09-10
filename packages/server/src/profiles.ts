/** Profiles patch the one bundle catalogue; they define no modules or rows. */
export const PROFILES = { web: {}, surface: {}, "test-minimal": {} } as const
export type Profile = keyof typeof PROFILES
