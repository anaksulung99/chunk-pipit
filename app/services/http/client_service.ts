import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios'
import logger from '@adonisjs/core/services/logger'

export interface HttpClientConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  withCredentials?: boolean
}

export class HttpClientService {
  private client: AxiosInstance

  constructor(config: HttpClientConfig) {
    if (!config.baseURL) {
      throw new Error('baseURL is required when creating HttpClientService instance')
    }

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config?.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config?.headers,
      },
      withCredentials: config?.withCredentials || false,
    })

    this.setupInterceptors()
  }

  /**
   * Create a new HttpClientService instance.
   * @param config - The configuration for the HttpClientService.
   * @returns The created HttpClientService instance.
   */
  public static create(config: HttpClientConfig): HttpClientService {
    return new HttpClientService(config)
  }
  /**
   * Set up Axios request and response interceptors.
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`HTTP Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)

        const token = this.getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        return config
      },
      (error) => {
        logger.error('Request Error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`HTTP Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error: AxiosError) => {
        this.handleError(error)
        return Promise.reject(error)
      }
    )
  }
  /**
   * Get the authentication token from the request context.
   * @returns The authentication token or null if not found.
   */
  private getAuthToken(): string | null {
    // Ambil dari context atau parameter
    return null
  }
  /**
   * Handle Axios errors.
   * @param error - The Axios error object.
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      logger.error(`API Error ${error.response.status}:`, error.response.data)
    } else if (error.request) {
      logger.error('No response from server:', error.request)
    } else {
      logger.error('Request setup error:', error.message)
    }
  }

  /**
   * Send a request to the server using a generic GET request.
   * @param url - The URL to request.
   * @param config - Optional request configuration.
   * @returns The response data from the server.
   */
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get<T>(url, config)
    return response.data
  }
  /**
   * Send a request to the server using a generic POST request.
   * @param url - The URL to request.
   * @param data - Optional data to include in the request body.
   * @param config - Optional request configuration.
   * @returns The response data from the server.
   */
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post<T>(url, data, config)
    return response.data
  }

  /**
   * Update a resource on the server using a PUT request.
   * @param url - The URL to update the resource at.
   * @param data - Optional data to include in the request body.
   * @param config - Optional request configuration.
   * @returns The response data from the server.
   */
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put<T>(url, data, config)
    return response.data
  }

  /**
   * Update a resource on the server using a PATCH request.
   * @param url - The URL to update the resource at.
   * @param data - Optional data to include in the request body.
   * @param config - Optional request configuration.
   * @returns The response data from the server.
   */
  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch<T>(url, data, config)
    return response.data
  }

  /**
   * Delete a resource from the server.
   * @param url - The URL to delete the resource from.
   * @param config - Optional request configuration.
   * @returns The response data from the server.
   */
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete<T>(url, config)
    return response.data
  }

  // Upload file
  /**
   * Upload a file to the server.
   * @param url - The URL to upload the file to.
   * @param file - The file to upload.
   * @param fieldName - The name of the form field to use for the file.
   * @param additionalData - Optional additional data to include in the request body.
   * @returns The response data from the server.
   */
  public async upload<T = any>(
    url: string,
    file: File | Blob,
    fieldName: string = 'file',
    additionalData?: Record<string, any>
  ): Promise<T> {
    const formData = new FormData()
    formData.append(fieldName, file)

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  }

  /**
   * Get the raw response from the server for a GET request.
   * @param url - The URL to request.
   * @param config - Optional request configuration.
   * @returns The raw response from the server.
   */
  public async getRaw<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return await this.client.get<T>(url, config)
  }

  /**
   * Get the raw response from the server for a POST request.
   * @param url - The URL to request.
   * @param data - Optional data to include in the request body.
   * @param config - Optional request configuration.
   * @returns The raw response from the server.
   */
  public async postRaw<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return await this.client.post<T>(url, data, config)
  }
}
