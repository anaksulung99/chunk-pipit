export function normalizeGroupTags(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ]
}

export function splitGroupTags(text?: string | null): string[] {
  if (!text) return []

  return normalizeGroupTags(
    text
      .split(/[,\n|]/)
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

export function mergeGroupTags(...groups: Array<Array<string | null | undefined> | null | undefined>) {
  return normalizeGroupTags(groups.flatMap((group) => group ?? []))
}
