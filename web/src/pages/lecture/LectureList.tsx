/**
 * @file 讲义列表页面
 */

import { useEffect, useState, useMemo, useRef, memo } from 'react'
import { Card, Empty, Select, Grid as AntGrid, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { FixedSizeGrid as WindowGrid, areEqual } from 'react-window'
import { getLectures, type Lecture } from '@/api/lecture'
import { getCategoryTree } from '@/api/sku'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils'

// PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const { useBreakpoint } = AntGrid

// 讲义封面组件
const LectureCover = ({ pdfUrl }: { pdfUrl?: string }) => {
  const [hasError, setHasError] = useState(false)

  if (!pdfUrl || hasError) {
    return (
      <div style={{
        height: 150,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 14
      }}>
        📖 讲义
      </div>
    )
  }

  return (
    <div style={{ height: 150, overflow: 'hidden', background: 'var(--fill-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Document
        file={pdfUrl}
        onLoadError={() => setHasError(true)}
        loading={
          <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            加载中...
          </div>
        }
      >
        <Page
          pageNumber={1}
          width={180}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  )
}

interface GridItemData {
  lectures: Lecture[]
  columnCount: number
  navigate: (path: string) => void
}

// Memoized grid item component
const GridItem = memo(({ columnIndex, rowIndex, style, data }: {
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  data: GridItemData
}) => {
  const { lectures, columnCount, navigate } = data
  const index = rowIndex * columnCount + columnIndex

  if (index >= lectures.length) return null

  const item = lectures[index]

  return (
    <div style={{ ...style, padding: 8 }}>
      <Card
        hoverable
        cover={<LectureCover pdfUrl={item.pdfUrl} />}
        onClick={() => navigate(`/lectures/${item.id}`)}
        style={{ height: 'calc(100% - 16px)' }}
      >
        <Card.Meta
          title={item.title}
          description={
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.pageCount} 页</span>
              <span>{item.viewCount} 阅读</span>
            </div>
          }
        />
      </Card>
    </div>
  )
}, areEqual)

const LectureList = () => {
  const navigate = useNavigate()
  const { currentLevelId } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<number>()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(false)
  const gridRef = useRef<WindowGrid>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [containerHeight, setContainerHeight] = useState(400)

  // 监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      setContainerWidth(rect.width)
      setContainerHeight(rect.height)
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // 计算响应式列数
  const columnCount = useMemo(() => {
    if (isMobile) return 1
    if (screens.xl) return 4
    if (screens.lg) return 4
    if (screens.md) return 3
    if (screens.sm) return 2
    return 1
  }, [screens, isMobile])

  // 计算行数
  const rowCount = useMemo(() => {
    return Math.ceil(lectures.length / columnCount)
  }, [lectures.length, columnCount])

  // 计算列宽
  const columnWidth = useMemo(() => {
    const gutter = 16
    return (containerWidth - gutter * (columnCount - 1)) / columnCount
  }, [containerWidth, columnCount])

  // 行高
  const rowHeight = 320

  // 准备传递给网格的数据
  const gridItemData = useMemo<GridItemData>(() => ({
    lectures,
    columnCount,
    navigate,
  }), [lectures, columnCount, navigate])

  // 获取科目列表 (基于当前等级)
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentLevelId) {
        setSubjects([])
        return
      }

      try {
        const tree = await getCategoryTree()
        let foundSubjects: any[] = []

        for (const prof of tree) {
          for (const level of prof.levels || []) {
            if (level.id === currentLevelId) {
              foundSubjects = (level.subjects || []).map((s: any) => ({
                ...s,
                subjectId: s.id,
                subjectName: s.name,
              }))
              break
            }
          }
          if (foundSubjects.length > 0) break
        }

        setSubjects(foundSubjects)
        if (foundSubjects.length > 0) {
          setSelectedSubject(foundSubjects[0].subjectId)
        }
      } catch (error) {
        logger.error('获取科目列表失败', error)
      }
    }
    fetchSubjects()
  }, [currentLevelId])

  // 获取讲义列表
  useEffect(() => {
    if (selectedSubject) {
      const fetchLectures = async () => {
        setLoading(true)
        try {
          const res: any = await getLectures(selectedSubject)
          setLectures(Array.isArray(res) ? res : res.items || [])
        } catch (error) {
          logger.error('获取讲义列表失败', error)
        } finally {
          setLoading(false)
        }
      }
      fetchLectures()
    }
  }, [selectedSubject])

  // 当数据更新后滚动到顶部
  useEffect(() => {
    if (gridRef.current && !loading) {
      gridRef.current.scrollToItem({ columnIndex: 0, rowIndex: 0 })
    }
  }, [selectedSubject, loading])

  return (
    <div>
      <Card
        title="讲义列表"
        extra={
          currentLevelId && subjects.length > 0 ? (
            <Select
              style={{ width: isMobile ? 140 : 200 }}
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={subjects.map(s => ({ label: s.subjectName, value: s.subjectId }))}
              placeholder="选择科目"
            />
          ) : null
        }
      >
        {!currentLevelId ? (
          <Empty description="请先在首页选择已订阅的职业等级" />
        ) : subjects.length === 0 ? (
          <Empty description="当前等级下暂无科目" />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : lectures.length === 0 ? (
          <Empty description="暂无讲义" />
        ) : (
          <div ref={containerRef} style={{ height: 'calc(100vh - 300px)', minHeight: 400 }}>
            <WindowGrid
              ref={gridRef}
              columnCount={columnCount}
              columnWidth={columnWidth}
              height={containerHeight}
              rowCount={rowCount}
              rowHeight={rowHeight}
              width={containerWidth}
              itemData={gridItemData}
              className="lecture-grid"
            >
              {GridItem}
            </WindowGrid>
          </div>
        )}
      </Card>
    </div>
  )
}

export default LectureList
