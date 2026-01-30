/**
 * @file 订阅页面
 */

import { useState, useEffect } from 'react'
import { Card, Row, Col, Button, Tag, List, Empty, Typography, Space, Modal, Radio, message, Alert, Grid } from 'antd'
import { CrownOutlined, CheckCircleOutlined, AlipayCircleOutlined, WechatOutlined, PayCircleOutlined, CreditCardOutlined } from '@ant-design/icons'
import { getCategoryTree, getLevelPrices, type SkuPrice } from '@/api/sku'
import { getSubscriptions } from '@/api/user'
import { createOrder, getPayUrl, getPaymentInfo, type PaymentInfo } from '@/api/order'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

const Subscription = () => {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [categoryTree, setCategoryTree] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [prices, setPrices] = useState<SkuPrice[]>([])
  
  // 支付相关状态
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPrice, setSelectedPrice] = useState<SkuPrice>()
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat' | 'paypal' | 'stripe'>('alipay')
  const [loading, setLoading] = useState(false)
  
  // 支付配置
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({ testMode: false, providers: [] })

  // 获取分类树、订阅和支付配置
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [treeData, subscriptionsData, payInfo]: any[] = await Promise.all([
          getCategoryTree(),
          getSubscriptions(),
          getPaymentInfo(),
        ])
        setCategoryTree(treeData || [])
        setSubscriptions(subscriptionsData || [])
        setPaymentInfo(payInfo || { testMode: false, providers: [] })
        
        // 设置默认支付方式为第一个启用的支付方式
        if (payInfo?.providers?.length > 0) {
          setPayMethod(payInfo.providers[0])
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchData()
  }, [])

  // 获取价格
  useEffect(() => {
    if (selectedLevel) {
      const fetchPrices = async () => {
        try {
          const data = await getLevelPrices(selectedLevel)
          setPrices(data)
        } catch (error) {
          console.error(error)
        }
      }
      fetchPrices()
    }
  }, [selectedLevel])

  // 处理购买点击
  const handleBuyClick = (price: SkuPrice) => {
    setSelectedPrice(price)
    setIsModalOpen(true)
  }

  // 确认支付
  const handlePay = async () => {
    if (!selectedPrice) return
    setLoading(true)
    try {
      // 1. 创建订单
      const order = await createOrder(selectedPrice.id)
      
      // 2. 获取支付链接
      const res: any = await getPayUrl(order.orderNo, payMethod)
      
      // 3. 处理支付结果
      if (res.testModePaid) {
        // 测试模式：支付已自动完成
        message.success('【测试模式】支付成功，订阅已开通！')
        setIsModalOpen(false)
        // 刷新订阅列表
        const subs = await getSubscriptions()
        setSubscriptions(subs)
      } else if (res.payUrl) {
        // 正常模式：跳转到支付页面
        window.location.href = res.payUrl
      } else {
        message.error('获取支付链接失败')
      }
    } catch (error) {
      console.error(error)
      message.error('支付发起失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* 支付弹窗 */}
      <Modal
        title="确认支付"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={isMobile ? '92%' : 520}
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)}>取消</Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={loading} 
            onClick={handlePay}
            disabled={paymentInfo.providers.length === 0}
          >
            立即支付 ¥{selectedPrice?.price}
          </Button>
        ]}
      >
        <div style={{ padding: '20px 0' }}>
          {paymentInfo.testMode && (
            <Alert
              message="测试模式"
              description="当前为测试模式，支付将自动完成，无需真实付款"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <p>商品名称：{selectedPrice?.name || '订阅套餐'}</p>
          <p>有效期：{selectedPrice?.durationMonths ? (
            selectedPrice.durationMonths >= 12 
              ? `${Math.floor(selectedPrice.durationMonths / 12)} 年` 
              : `${selectedPrice.durationMonths} 个月`
          ) : '-'}</p>
          <p>支付金额：<span style={{ color: '#f50', fontSize: 18, fontWeight: 'bold' }}>¥{selectedPrice?.price}</span>
            {selectedPrice?.originalPrice && selectedPrice.originalPrice > selectedPrice.price && (
              <Text delete type="secondary" style={{ marginLeft: 8 }}>原价 ¥{selectedPrice.originalPrice}</Text>
            )}
          </p>
          
          {paymentInfo.providers.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <p style={{ marginBottom: 10 }}>选择支付方式：</p>
              <Radio.Group value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {paymentInfo.providers.includes('alipay') && (
                    <Radio value="alipay" style={{ width: '100%', padding: 10, border: '1px solid var(--border-color, #eee)', borderRadius: 4 }}>
                      <Space>
                        <AlipayCircleOutlined style={{ color: '#1677ff', fontSize: 24 }} />
                        <span>支付宝</span>
                      </Space>
                    </Radio>
                  )}
                  {paymentInfo.providers.includes('wechat') && (
                    <Radio value="wechat" style={{ width: '100%', padding: 10, border: '1px solid var(--border-color, #eee)', borderRadius: 4 }}>
                      <Space>
                        <WechatOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                        <span>微信支付</span>
                      </Space>
                    </Radio>
                  )}
                  {paymentInfo.providers.includes('paypal') && (
                    <Radio value="paypal" style={{ width: '100%', padding: 10, border: '1px solid var(--border-color, #eee)', borderRadius: 4 }}>
                      <Space>
                        <PayCircleOutlined style={{ color: '#003087', fontSize: 24 }} />
                        <span>PayPal</span>
                      </Space>
                    </Radio>
                  )}
                  {paymentInfo.providers.includes('stripe') && (
                    <Radio value="stripe" style={{ width: '100%', padding: 10, border: '1px solid var(--border-color, #eee)', borderRadius: 4 }}>
                      <Space>
                        <CreditCardOutlined style={{ color: '#635bff', fontSize: 24 }} />
                        <span>Stripe (信用卡)</span>
                      </Space>
                    </Radio>
                  )}
                </Space>
              </Radio.Group>
            </div>
          ) : (
            <Alert
              message="暂无可用支付方式"
              description="管理员尚未配置支付方式，请联系管理员"
              type="error"
              showIcon
              style={{ marginTop: 20 }}
            />
          )}
        </div>
      </Modal>

      {/* 当前订阅 */}
      <Card title="我的订阅" style={{ marginBottom: 24 }}>
        {subscriptions.length > 0 ? (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 3, xxl: 3 }}
            dataSource={subscriptions}
            renderItem={(item) => (
              <List.Item>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <CrownOutlined style={{ color: '#faad14' }} />
                      <Text strong>{item.professionName} - {item.levelName}</Text>
                    </Space>
                    <Text type="secondary">
                      有效期至：{new Date(item.expireAt).toLocaleDateString()}
                    </Text>
                    <Tag color={new Date(item.expireAt) > new Date() ? 'green' : 'red'}>
                      {new Date(item.expireAt) > new Date() ? '有效' : '已过期'}
                    </Tag>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无订阅，快去购买吧" />
        )}
      </Card>

      {/* 购买订阅 */}
      <Card title="购买订阅">
        <Row gutter={[24, 24]}>
          {/* 左侧：等级选择 */}
          <Col xs={24} md={8}>
            <Title level={5}>选择考种等级</Title>
            <List
              size="small"
              bordered
              dataSource={categoryTree.flatMap((p) =>
                (p.levels || []).map((l: any) => ({
                  ...l,
                  levelId: l.id,
                  professionName: p.name,
                }))
              )}
              renderItem={(item: any) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    backgroundColor:
                      selectedLevel === item.levelId ? 'var(--color-primary-bg, #e6f4ff)' : undefined,
                  }}
                  onClick={() => setSelectedLevel(item.levelId)}
                >
                  <Text>{item.professionName} - {item.name}</Text>
                  {subscriptions.some((s) => s.levelId === item.levelId) && (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )}
                </List.Item>
              )}
            />
          </Col>

          {/* 右侧：价格选择 */}
          <Col xs={24} md={16}>
            <Title level={5}>选择订阅套餐</Title>
            {selectedLevel ? (
              <Row gutter={[16, 16]}>
                {prices.map((price) => {
                  // 使用后端配置的档位名称，或根据时长生成
                  const months = price.durationMonths || 0
                  const durationText = months >= 12 
                    ? `${Math.floor(months / 12)} 年` 
                    : `${months} 个月`
                  const cardType = price.name || (months >= 12 
                    ? '年卡' 
                    : months >= 6 
                      ? '半年卡'
                      : months >= 3 
                        ? '季卡' 
                        : months >= 1 
                          ? '月卡' 
                          : '体验卡')
                  
                  // 计算节省金额（确保数值比较）
                  const priceNum = Number(price.price)
                  const originalPriceNum = Number(price.originalPrice)
                  const savedAmount = originalPriceNum && originalPriceNum > priceNum 
                    ? (originalPriceNum - priceNum).toFixed(2)
                    : null
                  
                  return (
                    <Col xs={24} sm={12} md={8} key={price.id}>
                      <Card
                        hoverable
                        style={{ textAlign: 'center', position: 'relative', overflow: 'visible' }}
                      >
                        {savedAmount && (
                          <Tag 
                            color="red" 
                            style={{ 
                              position: 'absolute', 
                              top: 0, 
                              right: 0,
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: '0 8px 0 8px',
                              margin: 0
                            }}
                          >
                            省 ¥{savedAmount}
                          </Tag>
                        )}
                        <Tag color="blue" style={{ marginBottom: 8 }}>{cardType}</Tag>
                        <Title level={4} style={{ color: '#1677ff', margin: 0 }}>
                          ¥{price.price}
                        </Title>
                        {originalPriceNum > priceNum && (
                          <Text delete type="secondary">
                            原价 ¥{price.originalPrice}
                          </Text>
                        )}
                        <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)' }}>
                          有效期 {durationText}
                        </p>
                        <Button
                          type="primary"
                          block
                          style={{ marginTop: 16 }}
                          onClick={() => handleBuyClick(price)}
                        >
                          立即购买
                        </Button>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            ) : (
              <Empty description="请先选择考种等级" />
            )}
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Subscription
