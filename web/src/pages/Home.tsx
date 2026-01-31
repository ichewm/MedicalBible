/**
 * @file 首页
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Statistic, Button, Select, Space, Typography, List, Progress, Grid } from 'antd'
import {
  FileTextOutlined,
  ReadOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import { getCategoryTree } from '@/api/sku'
import { getSubscriptions, setCurrentLevel as setCurrentLevelApi } from '@/api/user'
import { getUserPracticeStats, UserPracticeStats } from '@/api/question'
import './Home.css'
import { logger } from '@/utils'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

const Home = () => {
  const navigate = useNavigate()
  const { user, setCurrentLevel } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [categoryTree, setCategoryTree] = useState<any[]>([])
  const [selectedProfession, setSelectedProfession] = useState<number>()
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [stats, setStats] = useState<UserPracticeStats | null>(null)

  // 获取分类树
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data: any = await getCategoryTree()
        setCategoryTree(data || [])
      } catch (error) {
        logger.error(error)
      }
    }
    fetchData()
  }, [])

  // 获取用户练习统计
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getUserPracticeStats()
        setStats(data)
      } catch (error) {
        logger.error('获取统计数据失败', error)
      }
    }
    fetchStats()
  }, [])

  // 获取订阅
  useEffect(() => {
    const fetchSubscriptions = async () => {
      // 从 localStorage 读取 token
      const stored = localStorage.getItem('medical-bible-auth')
      let token = null
      if (stored) {
        try {
          const { state } = JSON.parse(stored)
          token = state?.token
        } catch {
          // 忽略
        }
      }
      
      if (!token) {
        logger.log('No token found, skipping subscriptions fetch')
        return
      }
      
      try {
        const data = await getSubscriptions()
        if (Array.isArray(data)) {
          setSubscriptions(data)
        }
      } catch (error) {
        logger.error('获取订阅失败', error)
        // 不要因为订阅获取失败而影响页面
      }
    }
    // 延迟执行，确保 token 已加载
    const timer = setTimeout(fetchSubscriptions, 500)
    return () => clearTimeout(timer)
  }, [])

  // 计算已订阅的职业和等级（只显示有效订阅）
  const subscribedData = useMemo(() => {
    const now = new Date()
    const validSubs = subscriptions.filter(s => new Date(s.expireAt) > now)
    const levelIds = new Set(validSubs.map(s => s.levelId))
    
    const professions: { id: number; name: string; levels: any[] }[] = []
    
    for (const prof of categoryTree) {
      const matchedLevels = (prof.levels || []).filter((l: any) => levelIds.has(l.id))
      if (matchedLevels.length > 0) {
        professions.push({
          id: prof.id,
          name: prof.name,
          levels: matchedLevels.map((l: any) => ({
            id: l.id,
            name: l.name,
            subjects: l.subjects || [],
          })),
        })
      }
    }
    return professions
  }, [categoryTree, subscriptions])

  // 当前选中的等级下的科目
  const currentLevels = useMemo(() => {
    const prof = subscribedData.find(p => p.id === selectedProfession)
    return prof?.levels || []
  }, [subscribedData, selectedProfession])

  // 自动选择第一个已订阅的职业和等级
  useEffect(() => {
    if (subscribedData.length > 0 && !selectedProfession) {
      setSelectedProfession(subscribedData[0].id)
      if (subscribedData[0].levels.length > 0) {
        const firstLevelId = subscribedData[0].levels[0].id
        setSelectedLevel(firstLevelId)
        setCurrentLevel?.(firstLevelId)
      }
    }
  }, [subscribedData, selectedProfession, setCurrentLevel])

  // 当等级变化时，更新全局状态和后端
  useEffect(() => {
    if (selectedLevel) {
      setCurrentLevel?.(selectedLevel)
      // 同步到后端
      setCurrentLevelApi(selectedLevel).catch((e) => logger.error("切换考种失败", e))
    }
  }, [selectedLevel, setCurrentLevel])

  // 快捷入口
  const shortcuts = [
    {
      title: '题库练习',
      icon: <FileTextOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
      description: '海量真题模拟练习',
      path: '/questions',
    },
    {
      title: '讲义阅读',
      icon: <ReadOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      description: '专业讲义精讲',
      path: '/lectures',
    },
    {
      title: '错题本',
      icon: <ClockCircleOutlined style={{ fontSize: 32, color: '#faad14' }} />,
      description: '巩固薄弱环节',
      path: '/questions?tab=wrong',
    },
    {
      title: '考试记录',
      icon: <TrophyOutlined style={{ fontSize: 32, color: '#eb2f96' }} />,
      description: '查看历史成绩',
      path: '/questions?tab=history',
    },
  ]

  return (
    <div className="home">
      {/* 欢迎语和选择器 */}
      <Row gutter={[24, 16]} style={{ marginBottom: 24 }} align="middle">
        <Col xs={24} md={12}>
          <div className="home-welcome">
            <Title level={4} style={{ margin: 0 }}>
              👋 欢迎回来，{user?.username || user?.phone}
            </Title>
            <Text type="secondary">今天也要加油备考哦！</Text>
          </div>
        </Col>
        <Col xs={24} md={12}>
          {subscribedData.length > 0 ? (
            <div className="home-selector" style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              gap: 8,
              justifyContent: isMobile ? 'stretch' : 'flex-end'
            }}>
              <Select
                placeholder="选择职业"
                value={selectedProfession}
                onChange={(v) => {
                  setSelectedProfession(v)
                  const prof = subscribedData.find(p => p.id === v)
                  if (prof && prof.levels && prof.levels.length > 0) {
                    const newLevelId = prof.levels[0].id
                    setSelectedLevel(newLevelId)
                    setCurrentLevel?.(newLevelId)
                  } else {
                    setSelectedLevel(undefined)
                  }
                }}
                options={subscribedData.map((p) => ({ label: p.name, value: p.id }))}
                style={{ width: isMobile ? '100%' : 150 }}
              />
              <Select
                placeholder="选择等级"
                value={selectedLevel}
                onChange={(v) => {
                  setSelectedLevel(v)
                  setCurrentLevel?.(v)
                }}
                options={currentLevels.map((l) => ({ label: l.name, value: l.id }))}
                style={{ width: isMobile ? '100%' : 150 }}
              />
            </div>
          ) : (
            <Button type="primary" block={isMobile} onClick={() => navigate('/subscription')}>
              立即订阅开始学习
            </Button>
          )}
        </Col>
      </Row>

      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }} className="home-stats">
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card blue" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
            <Statistic
              title="今日练题"
              value={stats?.todayAnswered ?? 0}
              suffix="题"
              valueStyle={{ color: '#1677ff', fontSize: isMobile ? 18 : 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card green" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
            <Statistic
              title="累计练题"
              value={stats?.totalAnswered ?? 0}
              suffix="题"
              valueStyle={{ color: '#52c41a', fontSize: isMobile ? 18 : 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card yellow" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
            <Statistic
              title="正确率"
              value={stats?.correctRate ?? 0}
              suffix="%"
              valueStyle={{ color: '#faad14', fontSize: isMobile ? 18 : 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card pink" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
            <Statistic
              title="错题本"
              value={stats?.wrongBookCount ?? 0}
              suffix="题"
              valueStyle={{ color: '#eb2f96', fontSize: isMobile ? 18 : 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷入口 */}
      <Title level={5} style={{ marginBottom: 16 }}>
        快捷入口
      </Title>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }} className="home-shortcuts">
        {shortcuts.map((item) => (
          <Col xs={12} sm={6} key={item.title}>
            <Card
              hoverable
              className="shortcut-card"
              onClick={() => navigate(item.path)}
              style={{ textAlign: 'center' }}
              styles={{ body: { padding: isMobile ? 12 : 16 } }}
            >
              <div style={{ marginBottom: 8 }}>{item.icon}</div>
              <Title level={5} style={{ margin: 0, fontSize: isMobile ? 13 : 14 }}>
                {item.title}
              </Title>
              {!isMobile && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {item.description}
                </Text>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* 订阅信息 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title="我的订阅"
            extra={
              <Button type="link" onClick={() => navigate('/subscription')}>
                查看全部 <RightOutlined />
              </Button>
            }
          >
            {subscriptions.length > 0 ? (
              <List
                dataSource={subscriptions.slice(0, 3)}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.level?.name}
                      description={`有效期至：${item.expireAt}`}
                    />
                    <Progress
                      percent={Math.floor(
                        ((new Date(item.expireAt).getTime() - Date.now()) /
                          (30 * 24 * 60 * 60 * 1000)) *
                          100
                      )}
                      size="small"
                      style={{ width: 100 }}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Text type="secondary">暂无订阅</Text>
                <br />
                <Button
                  type="primary"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate('/subscription')}
                >
                  立即订阅
                </Button>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="学习提醒">
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Text type="secondary">今日还未开始学习</Text>
              <br />
              <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/lectures')}>
                开始学习
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Home
