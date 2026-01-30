import request from '@/utils/request'

export interface Order {
  id: number
  orderNo: string
  amount: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  skuPriceId: number
  createdAt: string
  paidAt?: string
}

export interface PaymentInfo {
  testMode: boolean
  providers: ('alipay' | 'wechat' | 'paypal' | 'stripe')[]
}

// 获取支付配置信息
export function getPaymentInfo(): Promise<PaymentInfo> {
  return request.get('/order/payment-info')
}

// 创建订单
export function createOrder(skuPriceId: number) {
  return request.post<any, Order>('/order', { skuPriceId })
}

// 获取订单列表
export function getOrders(params?: { status?: string; page?: number; pageSize?: number }) {
  return request.get('/order', { params })
}

// 获取订单详情
export function getOrderDetail(id: number) {
  return request.get(`/order/${id}`)
}

// 取消订单
export function cancelOrder(orderNo: string) {
  return request.post(`/order/${orderNo}/cancel`)
}

// 获取支付链接
export function getPayUrl(orderNo: string, payMethod: 'alipay' | 'wechat' | 'paypal' | 'stripe') {
  // 1 = 支付宝, 2 = 微信, 3 = PayPal, 4 = Stripe
  const payMethodMap: Record<string, number> = {
    alipay: 1,
    wechat: 2,
    paypal: 3,
    stripe: 4
  }
  return request.post(`/order/${orderNo}/pay`, { payMethod: payMethodMap[payMethod] })
}
