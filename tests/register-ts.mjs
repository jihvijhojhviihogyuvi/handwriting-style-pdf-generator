/**
 * Node's built-in TypeScript stripping requires fully specified import paths, while
 * Next.js (and every other bundler) resolves extensionless relative imports. This tiny
 * resolver hook bridges the two so the same source files can run under `node --test`
 * without changing a single application import.
 */
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const EXACT_EXTENSION = /\\.[cm]?[jt]sx?$/i

      export async function resolve(specifier, context, nextResolve) {
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
        if (isRelative && !EXACT_EXTENSION.test(specifier)) {
          for (const candidate of [specifier + '.ts', specifier + '.tsx', specifier + '/index.ts']) {
            try {
              return await nextResolve(candidate, context)
            } catch {
              // try the next candidate
            }
          }
        }
        return nextResolve(specifier, context)
      }
    `),
  import.meta.url
)
