import { twMerge } from 'tailwind-merge'

/** Joins truthy class names; later arguments win on conflicting utilities. */
export function cx(...classes) {
  return twMerge(classes.filter(Boolean).join(' '))
}
