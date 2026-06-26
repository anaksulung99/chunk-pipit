import { reactive, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'

export type TableOrder = 'asc' | 'desc'

export type TableMeta = {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  firstPage: number
}

type Options = {
  /** Inertia props to refresh on reload (partial reload). */
  only?: string[]
  initial?: {
    search?: string
    sort?: string
    order?: TableOrder
    perPage?: number
    /** Arbitrary column filters, e.g. { status: 'active', protocol: 'http' }. */
    filters?: Record<string, string>
  }
}

/**
 * Server-side table state (search / filters / sort / pagination) backed by the
 * current Inertia page. Every change issues a partial `router.get` to the same
 * URL so the controller re-renders the filtered slice. A filter value of 'all'
 * is treated as "no filter" and omitted from the query.
 */
export function useDataTable(options: Options = {}) {
  const init = options.initial ?? {}
  const search = ref(init.search ?? '')
  const sort = ref(init.sort ?? 'created_at')
  const order = ref<TableOrder>(init.order ?? 'desc')
  const perPage = ref(init.perPage ?? 15)
  const filters = reactive<Record<string, string>>({ ...(init.filters ?? {}) })
  const loading = ref(false)

  function reload(extra: Record<string, string | number | boolean | undefined> = {}) {
    const filterParams: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(filters)) {
      filterParams[key] = value && value !== 'all' ? value : undefined
    }
    const params: Record<string, string | number | boolean | undefined> = {
      search: search.value || undefined,
      ...filterParams,
      sort: sort.value,
      order: order.value,
      per_page: perPage.value,
      ...extra,
    }
    router.get(window.location.pathname, params, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      only: options.only,
      onStart: () => (loading.value = true),
      onFinish: () => (loading.value = false),
    })
  }

  let debounce: ReturnType<typeof setTimeout> | undefined
  watch(search, () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => reload({ page: 1 }), 300)
  })

  function toggleSort(key: string) {
    if (sort.value === key) {
      order.value = order.value === 'asc' ? 'desc' : 'asc'
    } else {
      sort.value = key
      order.value = 'asc'
    }
    reload({ page: 1 })
  }

  function setFilter(key: string, value: string) {
    filters[key] = value
    reload({ page: 1 })
  }

  function setPerPage(value: number) {
    perPage.value = value
    reload({ page: 1 })
  }

  function goToPage(page: number) {
    reload({ page })
  }

  return {
    search,
    sort,
    order,
    perPage,
    filters,
    loading,
    reload,
    toggleSort,
    setFilter,
    setPerPage,
    goToPage,
  }
}
