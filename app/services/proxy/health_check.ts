import { HttpClientService } from '#services/http/client_service'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee'
import logger from '@adonisjs/core/services/logger'

export type ProxyHealth = {
  status: 'healthy' | 'slow' | 'dead'
  responseMs: number | null
  ipinfo?: IPinfo | null
}
export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5'

export type ProxyHealthCheckOptions = {
  username?: string | null
  password?: string | null
  timeoutMs?: number
  testUrl?: string
  crawleeTestUrl?: string
}

export type IPinfo = {
  ip: string
  asn: string
  as_name: string
  as_domain: string
  country_code: string
  country: string
  continent_code: string
  continent: string
}

function buildProxyUrl(
  protocol: ProxyProtocol,
  host: string,
  port: number,
  username?: string | null,
  password?: string | null
) {
  const auth = username
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password ?? '')}@`
    : ''

  return `${protocol}://${auth}${host}:${port}`
}

function createProxyAgent(proxyUrl: string, protocol: ProxyProtocol) {
  if (protocol === 'http') return new HttpProxyAgent(proxyUrl)
  if (protocol === 'https') return new HttpsProxyAgent(proxyUrl)

  return new SocksProxyAgent(proxyUrl)
}

/**
 * Checks proxy health using two layers:
 *
 * 1. Direct HTTP request via Axios + protocol-specific proxy agent.
 * 2. Crawlee request via ProxyConfiguration.
 *
 * The proxy is marked healthy/slow only when both layers pass.
 */
export async function tcpHealthCheck(
  protocol: ProxyProtocol,
  host: string,
  port: number,
  options: ProxyHealthCheckOptions = {}
): Promise<ProxyHealth> {
  const timeoutMs = options.timeoutMs ?? 5000
  const testUrl = options.testUrl ?? 'https://api.ipify.org?format=json'
  const crawleeTestUrl = options.crawleeTestUrl ?? testUrl
  const targetUrl = new URL(testUrl)
  const httpClient = HttpClientService.create({
    baseURL: targetUrl.origin,
    timeout: timeoutMs,
  })
  const proxyUrl = buildProxyUrl(protocol, host, port, options.username, options.password)
  const agent = createProxyAgent(proxyUrl, protocol)
  const start = Date.now()

  try {
    await httpClient.getRaw(`${targetUrl.pathname}${targetUrl.search}`, {
      timeout: timeoutMs,
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
    })

    const crawleeResult = await crawleeHealthCheck(protocol, host, port, {
      ...options,
      timeoutMs,
      testUrl: crawleeTestUrl,
    })

    if (crawleeResult.status === 'dead') {
      logger.error(`Proxy ${proxyUrl} is dead with response time ${Date.now() - start}ms`)
      return crawleeResult
    }

    const ipinfo = await getIpInfo(host)

    logger.info(
      `Proxy ${proxyUrl} is healthy with response time ${Date.now() - start}ms, country code ${ipinfo?.country_code}`
    )
    const responseMs = Date.now() - start
    return {
      status: responseMs < 2000 ? 'healthy' : 'slow',
      responseMs,
      ipinfo,
    }
  } catch (error) {
    logger.error(
      `Proxy ${proxyUrl} is dead with response time ${Date.now() - start}ms, error ${error}`
    )
    return {
      status: 'dead',
      responseMs: null,
    }
  }
}

export async function crawleeHealthCheck(
  protocol: ProxyProtocol,
  host: string,
  port: number,
  options: ProxyHealthCheckOptions = {}
): Promise<ProxyHealth> {
  const timeoutMs = options.timeoutMs ?? 5000
  const timeoutSecs = Math.max(1, Math.ceil(timeoutMs / 1000))
  const testUrl = options.testUrl ?? 'https://api.ipify.org?format=json'
  const proxyUrl = buildProxyUrl(protocol, host, port, options.username, options.password)
  const start = Date.now()
  let passed = false

  const crawler = new PlaywrightCrawler({
    proxyConfiguration: new ProxyConfiguration({
      proxyUrls: [proxyUrl],
    }),
    maxRequestsPerCrawl: 1,
    maxRequestRetries: 0,
    requestHandlerTimeoutSecs: timeoutSecs,
    navigationTimeoutSecs: timeoutSecs,
    useSessionPool: false,
    autoscaledPoolOptions: {
      minConcurrency: 1,
      maxConcurrency: 1,
    },
    requestHandler({ response }) {
      const statusCode = response?.status() ?? 0
      if (!statusCode || statusCode < 200 || statusCode >= 400) {
        throw new Error(`Crawlee proxy health check failed with status ${statusCode}`)
      }

      passed = true
    },
  })

  try {
    await crawler.run([testUrl])

    if (!passed) {
      logger.error(`Proxy ${proxyUrl} is dead with response time ${Date.now() - start}ms`)
      return {
        status: 'dead',
        responseMs: null,
      }
    }

    logger.info(`Proxy ${proxyUrl} is healthy with response time ${Date.now() - start}ms`)

    const responseMs = Date.now() - start
    return {
      status: responseMs < 2000 ? 'healthy' : 'slow',
      responseMs,
    }
  } catch (error) {
    logger.error(
      `Proxy ${proxyUrl} is dead with response time ${Date.now() - start}ms, error ${error}`
    )
    return {
      status: 'dead',
      responseMs: null,
    }
  }
}

export async function getIpInfo(host: string) {
  const timeoutMs = 5000
  const testUrl = `https://api.ipinfo.io/lite/${host}?token=cd536d4bc998cf`
  const targetUrl = new URL(testUrl)
  const httpClient = HttpClientService.create({
    baseURL: targetUrl.origin,
    timeout: timeoutMs,
  })

  const ipinfo = await httpClient.getRaw<IPinfo>(testUrl)
  return ipinfo.data
}
