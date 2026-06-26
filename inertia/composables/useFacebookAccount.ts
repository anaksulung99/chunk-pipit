type AccountHealthStatus = 'active' | 'checkpoint' | 'logged_out' | 'server_error'

type AccountHealthResponse = {
  status: number
  message: string
  data: AccountHealthStatus
}

type AccountHealthResult = {
  id: string
  status: AccountHealthStatus
  message: string
}

interface BulkCheckResponse {
  total: number
  active: number
  checkpoint: number
  logged_out: number
  failed: number
  error: string[]
  results: AccountHealthResult[]
}

const endpoint = '/api/facebook-accounts/health-check'

export const useFacebookAccount = () => {
  const isLoading = ref(false)
  const hasChecked = ref(false)
  const checkProgress = ref(0)
  const showProgressModal = ref(false)
  const addProgress = reactive({
    total: 0,
    current: 0,
    active: 0,
    checkpoint: 0,
    logged_out: 0,
    failed: 0,
    currentProfileId: '',
  })

  function resetProgress(total: number) {
    addProgress.total = total
    addProgress.current = 0
    addProgress.active = 0
    addProgress.checkpoint = 0
    addProgress.logged_out = 0
    addProgress.failed = 0
    addProgress.currentProfileId = ''
    checkProgress.value = 0
    hasChecked.value = false
  }

  function updateProgress(id: string) {
    addProgress.current++
    addProgress.currentProfileId = id
    checkProgress.value = addProgress.total
      ? Math.round((addProgress.current / addProgress.total) * 100)
      : 0
  }

  async function checkOne(id: string): Promise<AccountHealthResult> {
    updateProgress(id)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ accountId: id }),
    })

    const payload = (await response.json().catch(() => ({
      status: response.status,
      message: response.statusText || 'Gagal cek status akun.',
      data: 'server_error',
    }))) as AccountHealthResponse

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

  function applyResult(result: AccountHealthResult, errors: string[]) {
    if (result.status === 'active') {
      addProgress.active++
      return
    }

    if (result.status === 'checkpoint') {
      addProgress.checkpoint++
      errors.push(result.message)
      return
    }

    if (result.status === 'logged_out') {
      addProgress.logged_out++
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
        active: 0,
        checkpoint: 0,
        logged_out: 0,
        failed: 0,
        error: [],
        results: [],
      }
    }

    showProgressModal.value = true
    isLoading.value = true

    const errors: string[] = []
    const results: AccountHealthResult[] = []

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
      active: addProgress.active,
      checkpoint: addProgress.checkpoint,
      logged_out: addProgress.logged_out,
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
