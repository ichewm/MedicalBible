/**
 * @file SKU API
 */

import request from '@/utils/request'

export interface Profession {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  levels?: Level[]
}

export interface Level {
  id: number
  professionId: number
  name: string
  sortOrder: number
  isActive: boolean
  subjects?: Subject[]
  prices?: SkuPrice[]
}

export interface Subject {
  id: number
  levelId: number
  name: string
  sortOrder: number
  isActive: boolean
}

export interface SkuPrice {
  id: number
  levelId: number
  name: string
  durationMonths: number  // 订阅时长（月）
  price: number
  originalPrice?: number
  isActive: boolean
}

// 获取分类树（职业-等级-科目）
export function getCategoryTree(): Promise<Profession[]> {
  return request.get('/sku/tree')
}

// 获取等级价格列表
export function getLevelPrices(levelId: number): Promise<SkuPrice[]> {
  return request.get(`/sku/levels/${levelId}/prices`)
}

// 获取职业列表
export function getProfessions(): Promise<Profession[]> {
  return request.get('/sku/professions')
}

// 获取等级列表
export function getLevelsByProfession(professionId: number): Promise<Level[]> {
  return request.get(`/sku/professions/${professionId}/levels`)
}

// 获取科目列表
export function getSubjectsByLevel(levelId: number): Promise<Subject[]> {
  return request.get(`/sku/levels/${levelId}/subjects`)
}

// 获取价格档位列表
export function getPricesByLevel(levelId: number): Promise<SkuPrice[]> {
  return request.get(`/sku/levels/${levelId}/prices`)
}
