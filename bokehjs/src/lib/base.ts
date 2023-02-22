import {isObject, isArray} from "./core/util/types"
import {values} from "./core/util/object"
import {isString} from "./core/util/types"
import {HasProps} from "./core/has_props"
import {ModelResolver} from "./core/resolvers"

export const default_resolver = new ModelResolver(null)

export const Models = new Proxy(default_resolver, {
  get(target: ModelResolver, name: string | symbol, _receiver: unknown): unknown {
    if (name in target) {
      return (target as any)[name]
    }
    if (isString(name)) {
      const model = target.get(name)
      if (model != null) {
        return model
      }
    }
    return undefined
  },
})

function is_HasProps(obj: unknown): obj is typeof HasProps {
  return isObject(obj) && (obj as any).prototype instanceof HasProps
}

export function register_models(models: {[key: string]: unknown} | unknown[], force: boolean = false): void {
  for (const model of isArray(models) ? models : values(models)) {
    if (is_HasProps(model)) {
      default_resolver.register(model, force)
    }
  }
}
