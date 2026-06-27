type ProxyStatus = 'healthy' | 'slow' | 'dead' | 'server_error'

type ProxyHealthResponse = {
  status: number
  message: string
  data: ProxyStatus
}
type ProxyHealthResult = {
  id: string
  status: ProxyStatus
  message: string
}
interface BulkCheckResponse {
  total: number
  healthy: number
  slow: number
  dead: number
  failed: number
  error: string[]
  results: ProxyHealthResult[]
}

const endpoint = '/api/proxies/health-check'

export const useProxyHealthCheck = () => {
  const isLoading = ref(false)
  const hasChecked = ref(false)
  const checkProgress = ref(0)
  const showProgressModal = ref(false)
  const addProgress = reactive({
    total: 0,
    current: 0,
    healthy: 0,
    slow: 0,
    dead: 0,
    failed: 0,
    currentProxyId: '',
  })

  function resetProgress(total: number) {
    addProgress.total = total
    addProgress.current = 0
    addProgress.healthy = 0
    addProgress.slow = 0
    addProgress.dead = 0
    addProgress.failed = 0
    addProgress.currentProxyId = ''
    checkProgress.value = 0
    hasChecked.value = false
  }

  function updateProgress(id: string) {
    addProgress.current++
    addProgress.currentProxyId = id
    checkProgress.value = addProgress.total
      ? Math.round((addProgress.current / addProgress.total) * 100)
      : 0
  }

  async function checkOne(id: string): Promise<ProxyHealthResult> {
    updateProgress(id)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ proxyId: id }),
    })

    const payload = (await response.json().catch(() => ({
      status: response.status,
      message: response.statusText || 'Gagal cek status proxy.',
      data: 'server_error',
    }))) as ProxyHealthResponse

    if (!response.ok) {
      return {
        id,
        status: 'server_error',
        message: payload.message || `HTTP ${response.status}`,
      }
    }

    return {
      id,
      status: payload.data,
      message: payload.message,
    }
  }

  function applyResult(result: ProxyHealthResult, errors: string[]) {
    if (result.status === 'healthy') {
      addProgress.healthy++
      return
    }

    if (result.status === 'slow') {
      addProgress.slow++
      errors.push(result.message)
      return
    }

    if (result.status === 'dead') {
      addProgress.dead++
      errors.push(result.message)
      return
    }

    addProgress.failed++
    errors.push(result.message)
  }

  const check = async (ids: string[], concurrency = 5): Promise<BulkCheckResponse> => {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    resetProgress(uniqueIds.length)

    if (!uniqueIds.length) {
      hasChecked.value = true
      return {
        total: 0,
        healthy: 0,
        slow: 0,
        dead: 0,
        failed: 0,
        error: [],
        results: [],
      }
    }

    showProgressModal.value = true
    isLoading.value = true

    const errors: string[] = []
    const results: ProxyHealthResult[] = []

    try {
      for (let i = 0; i < uniqueIds.length; i += concurrency) {
        const batch = uniqueIds.slice(i, i + concurrency)
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            try {
              return await checkOne(id)
            } catch (error) {
              updateProgress(id)
              return {
                id,
                status: 'server_error' as const,
                message: error instanceof Error ? error.message : String(error),
              }
            }
          })
        )

        for (const result of batchResults) {
          results.push(result)
          applyResult(result, errors)
        }
      }
    } finally {
      isLoading.value = false
      hasChecked.value = true
      setTimeout(() => {
        showProgressModal.value = false
      }, 2000)
    }

    return {
      total: uniqueIds.length,
      healthy: addProgress.healthy,
      slow: addProgress.slow,
      dead: addProgress.dead,
      failed: addProgress.failed,
      error: errors,
      results,
    }
  }

  return {
    isLoading,
    hasChecked,
    checkProgress,
    showProgressModal,
    addProgress,
    check,
  }
}
