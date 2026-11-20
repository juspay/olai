import { Context } from "effect"

export interface ServiceKey<Shape> extends Context.Service<Shape, Shape> {
  readonly cordis: string
}

export interface ConsumerLifetime {
  readonly current: () => boolean
}

export type Provision<Shape> = (plugin: string, lifetime?: ConsumerLifetime) => Shape

export const serviceTag = <Shape>(cordis: string): ServiceKey<Shape> =>
  Object.assign(Context.Service<Shape>(`effect-cordis/${cordis}`), { cordis })

export type AnyKey = Context.Service.Any & { readonly cordis: string }
