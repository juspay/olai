import { serviceTag } from "@olai/plugin-api/services"
export const name = "vault-plugins"
export const chunks = serviceTag<{ readonly chunk: (path: string) => string | null }>("vault-plugins.chunks")
