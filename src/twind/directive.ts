import type { Context, Directive, MaybeThunk } from '../types'

import * as is from '../internal/is'
import { ensureMaxSize, evalThunk } from '../internal/util'

const ensureNoFunctions = (key: string, value: unknown): unknown => {
  if (is.function(value)) {
    throw 0
  }

  return value
}

const stringify = (data: unknown): string | undefined => {
  try {
    return JSON.stringify(data, ensureNoFunctions)
  } catch {
    /* ignore */
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const cacheByFactory = new WeakMap<
  (data: any, context: Context) => any,
  Map<string, Directive<any>>
>()
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Returns an optimized and cached function for use with `tw`.
 *
 * `tw` caches rules based on the function identity. This helper caches
 * the function based on the data.
 *
 * @param factory to use when the directive is invoked
 * @param data to use
 */
export const directive = <Data, T>(
  factory: (data: Data, context: Context) => MaybeThunk<T>,
  data: Data,
): Directive<T> => {
  const key = stringify(data)

  let directive: Directive<T> | undefined

  if (key) {
    // eslint-disable-next-line no-var
    var cache = cacheByFactory.get(factory)
    if (!cache) {
      cacheByFactory.set(factory, (cache = new Map()))
    }

    directive = cache.get(key)
  }

  if (!directive) {
    directive = Object.defineProperty(
      (params: string[] | Context, context: Context): T => {
        context = Array.isArray(params) ? context : params
        return evalThunk(factory(data, context), context)
      },
      'toJSON',
      {
        // Allow twind to generate a unique id for this directive
        // twind uses JSON.stringify which returns undefined for functions like this directive
        // providing a toJSON function allows to include this directive in the id generation
        value: () => key || data,
      },
    )

    if (cache) {
      cache.set(key as string, directive as Directive<T>)

      // Ensure the cache does not grow unlimited
      ensureMaxSize(cache, 10000)
    }
  }

  return directive as Directive<T>
}
