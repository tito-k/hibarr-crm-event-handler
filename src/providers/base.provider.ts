import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils';

abstract class BaseProvider {
  protected readonly axios: AxiosInstance;

  constructor(baseURL: string) {
    this.axios = axios.create({ baseURL });
  }

  protected abstract getHeaders(): Promise<Record<string, string>>;

  protected async makeRequest<T>(
    method: string,
    url: string,
    data?: any,
  ): Promise<T> {
    try {
      const headers = await this.getHeaders();

      const response = await this.axios.request({ method, url, data, headers });

      return response.data;
    } catch (error) {
      logger.error('Error from base provider while making request', error);
      throw error;
    }
  }
}

export default BaseProvider;
