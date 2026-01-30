/**
 * @file API 请求工具
 * @description 封装 axios，统一处理请求和响应
 */

import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useAuthStore } from '@/stores/auth'

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { token } = useAuthStore.getState()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    // 如果返回的是标准格式 { code, message, data }，则提取 data
    if (res && typeof res === 'object' && 'code' in res && 'data' in res) {
      if (res.code === 200) {
        return res.data
      } else {
        // 业务错误
        message.error(res.message || '请求失败')
        return Promise.reject(new Error(res.message || '请求失败'))
      }
    }
    // 否则直接返回
    return res
  },
  async (error: AxiosError<{ message: string }>) => {
    const { response } = error

    if (response) {
      switch (response.status) {
        case 401: {
          // Token 过期或未登录
          const { refreshToken, logout, token } = useAuthStore.getState()
          
          // 如果当前没有 token，可能是刚登录完还没加载，不处理
          if (!token) {
            break
          }
          
          if (refreshToken) {
            try {
              const res = await axios.post('/api/v1/auth/refresh-token', { refreshToken })
              useAuthStore.getState().setAuth(
                res.data.data.accessToken,
                res.data.data.refreshToken,
                useAuthStore.getState().user!
              )
              // 重试原请求
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${res.data.data.accessToken}`
                return request(error.config)
              }
            } catch {
              logout()
              message.error('登录已过期，请重新登录')
              window.location.href = '/login'
            }
          } else {
            logout()
            message.error('请先登录')
            window.location.href = '/login'
          }
          break
        }
        case 403: {
          // 检查是否是订阅权限问题
          const errorMsg = response.data?.message || ''
          if (errorMsg.includes('订阅') || errorMsg.includes('subscription') || errorMsg.includes('权限')) {
            message.warning('请先订阅后再访问')
            window.location.href = '/subscription'
          } else {
            message.error('没有权限访问')
          }
          break
        }
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error('服务器错误，请稍后重试')
          break
        default:
          message.error(response.data?.message || '请求失败')
      }
    } else {
      message.error('网络错误，请检查网络连接')
    }

    return Promise.reject(error)
  }
)

export default request
