export const PROFILES = { web: {}, surface: {}, "test-minimal": {} } as const
export type Profile = keyof typeof PROFILES
