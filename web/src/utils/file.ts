/**
 * @file 文件路径工具
 * @description 处理文件 URL，支持 CDN/OSS 配置
 */

/**
 * 获取完整的文件 URL
 * @param path - 文件路径（相对路径或完整 URL）
 * @returns 完整的文件访问 URL
 * 
 * @example
 * // 相对路径自动拼接基础 URL
 * getFileUrl('/uploads/xxx.pdf') 
 * // => 'https://cdn.example.com/uploads/xxx.pdf' (如果配置了 VITE_FILE_BASE_URL)
 * // => '/uploads/xxx.pdf' (如果未配置)
 * 
 * // 完整 URL 直接返回
 * getFileUrl('https://example.com/file.pdf')
 * // => 'https://example.com/file.pdf'
 */
export function getFileUrl(path: string | undefined | null): string {
  if (!path) return ''
  
  // 如果已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  // 获取文件基础 URL 配置
  const fileBaseUrl = import.meta.env.VITE_FILE_BASE_URL
  
  // 如果配置了基础 URL，拼接完整路径
  if (fileBaseUrl) {
    // 确保路径以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    // 移除基础 URL 末尾的 /
    const normalizedBase = fileBaseUrl.endsWith('/') 
      ? fileBaseUrl.slice(0, -1) 
      : fileBaseUrl
    return `${normalizedBase}${normalizedPath}`
  }
  
  // 未配置则返回相对路径（浏览器会自动使用当前域名）
  return path
}

/**
 * 判断是否为相对路径
 * @param url - URL 字符串
 */
export function isRelativePath(url: string): boolean {
  return !url.startsWith('http://') && !url.startsWith('https://')
}
