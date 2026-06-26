import { computed, ref, type Ref } from 'vue'

export type SelectionPayload =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'all_matching'; excludedIds: string[] }

/**
 * Row selection with cross-page support.
 *
 * - Default mode tracks explicitly-checked ids.
 * - "Select all matching" mode flips to tracking *exclusions*, so a bulk action
 *   can target every row matching the current filters (sent to the server as
 *   { mode: 'all_matching', excludedIds }) without enumerating thousands of ids.
 */
export function useTableSelection(rows: Ref<Array<{ id: string }>>) {
  const selected = ref<Set<string>>(new Set())
  const excluded = ref<Set<string>>(new Set())
  const allMatching = ref(false)

  const pageIds = computed(() => rows.value.map((r) => r.id))

  function isSelected(id: string): boolean {
    return allMatching.value ? !excluded.value.has(id) : selected.value.has(id)
  }

  const allPageSelected = computed(
    () => pageIds.value.length > 0 && pageIds.value.every(isSelected)
  )
  const somePageSelected = computed(
    () => pageIds.value.some(isSelected) && !allPageSelected.value
  )
  const hasSelection = computed(() => allMatching.value || selected.value.size > 0)
  /** Number of explicitly-selected rows; null when in "all matching" mode. */
  const count = computed<number | null>(() => (allMatching.value ? null : selected.value.size))

  function bump() {
    selected.value = new Set(selected.value)
    excluded.value = new Set(excluded.value)
  }

  function toggleRow(id: string) {
    if (allMatching.value) {
      excluded.value.has(id) ? excluded.value.delete(id) : excluded.value.add(id)
    } else {
      selected.value.has(id) ? selected.value.delete(id) : selected.value.add(id)
    }
    bump()
  }

  function togglePage() {
    const selectAll = !allPageSelected.value
    for (const id of pageIds.value) {
      if (allMatching.value) {
        selectAll ? excluded.value.delete(id) : excluded.value.add(id)
      } else {
        selectAll ? selected.value.add(id) : selected.value.delete(id)
      }
    }
    bump()
  }

  function selectAllMatching() {
    allMatching.value = true
    selected.value = new Set()
    excluded.value = new Set()
  }

  function clear() {
    allMatching.value = false
    selected.value = new Set()
    excluded.value = new Set()
  }

  function payload(): SelectionPayload {
    return allMatching.value
      ? { mode: 'all_matching', excludedIds: [...excluded.value] }
      : { mode: 'ids', ids: [...selected.value] }
  }

  return {
    selected,
    excluded,
    allMatching,
    pageIds,
    isSelected,
    allPageSelected,
    somePageSelected,
    hasSelection,
    count,
    toggleRow,
    togglePage,
    selectAllMatching,
    clear,
    payload,
  }
}
