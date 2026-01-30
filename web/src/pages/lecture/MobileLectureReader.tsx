/**
 * @file 移动端翻书式PDF阅读器
 * @description 支持左右滑动翻页、全屏阅读、重点标注展示
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spin, message, FloatButton, Drawer, List, Tag, Empty } from 'antd'
import {
  LeftOutlined,
  HighlightOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  HomeOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Document, Page, pdfjs } from 'react-pdf'
import { getLectureDetail, getHighlights, updateProgress, type Lecture, type Highlight } from '@/api/lecture'
import { getFileUrl } from '@/utils/file'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './MobileLectureReader.css'

// PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const MobileLectureReader = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [lecture, setLecture] = useState<Lecture>()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)
  const [showPageList, setShowPageList] = useState(false)
  
  // 触摸滑动相关
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 进度保存防抖
  const saveProgressTimer = useRef<NodeJS.Timeout | null>(null)
  const lastSavedPage = useRef(0)

  // 保存进度
  const saveProgress = useCallback((page: number) => {
    if (!id || page === lastSavedPage.current) return
    
    if (saveProgressTimer.current) {
      clearTimeout(saveProgressTimer.current)
    }
    
    saveProgressTimer.current = setTimeout(async () => {
      try {
        await updateProgress(Number(id), page)
        lastSavedPage.current = page
      } catch (error) {
        console.error('保存进度失败:', error)
      }
    }, 1500)
  }, [id])

  // 初始化
  useEffect(() => {
    const init = async () => {
      if (!id) return
      setLoading(true)
      try {
        const data: any = await getLectureDetail(Number(id))
        setLecture(data)
        
        if (data.lastPage && data.lastPage > 0) {
          setPageNumber(data.lastPage)
          lastSavedPage.current = data.lastPage
        }
        
        // 单独加载重点标注，失败时不影响讲义显示
        try {
          const highlightsData: any = await getHighlights(Number(id))
          setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData.items || [])
        } catch (highlightError) {
          console.error('加载重点标注失败:', highlightError)
          // 重点标注加载失败时，保持空数组，不影响讲义阅读
        }
      } catch (error) {
        console.error(error)
        message.error('加载讲义失败')
      } finally {
        setLoading(false)
      }
    }
    init()
    
    return () => {
      if (saveProgressTimer.current) {
        clearTimeout(saveProgressTimer.current)
      }
    }
  }, [id])

  // 页码变化保存进度
  useEffect(() => {
    if (pageNumber > 0 && numPages > 0) {
      saveProgress(pageNumber)
    }
  }, [pageNumber, numPages, saveProgress])

  // PDF加载成功
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // 翻页
  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => Math.min(numPages, prev + 1))
  }, [numPages])

  const goToPage = useCallback((page: number) => {
    setPageNumber(Math.max(1, Math.min(numPages, page)))
    setShowPageList(false)
  }, [numPages])

  // 触摸事件处理 - 滑动翻页
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const deltaX = touchEndX - touchStartX.current
    const deltaY = touchEndY - touchStartY.current
    
    // 水平滑动距离大于垂直滑动，且超过阈值
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goToPrevPage() // 右滑上一页
      } else {
        goToNextPage() // 左滑下一页
      }
    }
  }

  // 点击翻页（点击左侧上一页，右侧下一页）
  const handleTap = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const x = e.clientX - rect.left
    const width = rect.width
    
    if (x < width * 0.3) {
      goToPrevPage()
    } else if (x > width * 0.7) {
      goToNextPage()
    }
  }

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 当前页的重点
  const currentHighlights = useMemo(() => 
    highlights.filter(h => h.pageIndex === pageNumber),
    [highlights, pageNumber]
  )

  // 有重点标注的页码
  const highlightPages = useMemo(() => 
    [...new Set(highlights.map(h => h.pageIndex))].sort((a, b) => a - b),
    [highlights]
  )

  if (loading) {
    return (
      <div className="mobile-reader-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!lecture) {
    return (
      <div className="mobile-reader-error">
        <Empty description="讲义不存在" />
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`mobile-reader ${isFullscreen ? 'fullscreen' : ''}`}
    >
      {/* 顶部导航栏 */}
      <div className="mobile-reader-header">
        <div className="mobile-reader-back" onClick={() => navigate(-1)}>
          <LeftOutlined />
        </div>
        <div className="mobile-reader-title">{lecture.title}</div>
        <div className="mobile-reader-progress">
          {pageNumber}/{numPages}
        </div>
      </div>

      {/* PDF内容区 */}
      <div 
        className="mobile-reader-content"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        <div className="mobile-reader-pdf-wrapper">
          <Document
            file={getFileUrl(lecture.fileUrl)}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<Spin tip="加载PDF..." />}
            error={<Empty description="PDF加载失败" />}
            className="mobile-reader-document"
          >
            <Page 
              pageNumber={pageNumber}
              width={window.innerWidth - 24}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="mobile-reader-page"
            />
          </Document>
          
          {/* 重点标注渲染层 */}
          {currentHighlights.map((h) => (
            (Array.isArray(h.data) ? h.data : []).map((rect: any, idx: number) => (
              <div
                key={`${h.id}-${idx}`}
                className="mobile-highlight-rect"
                style={{
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                  backgroundColor: rect.color || '#FFFF00',
                }}
              />
            ))
          ))}
        </div>

        {/* 翻页指示 */}
        <div className="mobile-reader-page-hint">
          {pageNumber > 1 && <span className="hint-prev">‹</span>}
          {pageNumber < numPages && <span className="hint-next">›</span>}
        </div>

        {/* 当前页重点提示 */}
        {currentHighlights.length > 0 && (
          <div 
            className="mobile-reader-highlight-badge"
            onClick={(e) => {
              e.stopPropagation()
              setShowHighlights(true)
            }}
          >
            <HighlightOutlined /> {currentHighlights.length}
          </div>
        )}
      </div>

      {/* 底部进度条 */}
      <div className="mobile-reader-footer">
        <div className="mobile-reader-slider">
          <input
            type="range"
            min={1}
            max={numPages || 1}
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
            className="page-slider"
          />
        </div>
      </div>

      {/* 悬浮按钮 */}
      <FloatButton.Group shape="circle" style={{ right: 16, bottom: 80 }}>
        <FloatButton
          icon={<UnorderedListOutlined />}
          tooltip="页码列表"
          onClick={() => setShowPageList(true)}
        />
        <FloatButton
          icon={<HighlightOutlined />}
          tooltip="重点标注"
          badge={{ count: highlights.length, color: '#1677ff' }}
          onClick={() => setShowHighlights(true)}
        />
        <FloatButton
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          tooltip={isFullscreen ? '退出全屏' : '全屏阅读'}
          onClick={toggleFullscreen}
        />
        <FloatButton
          icon={<HomeOutlined />}
          tooltip="返回首页"
          onClick={() => navigate('/')}
        />
      </FloatButton.Group>

      {/* 重点标注抽屉 */}
      <Drawer
        title="重点标注"
        placement="bottom"
        onClose={() => setShowHighlights(false)}
        open={showHighlights}
        height="60%"
      >
        {highlights.length === 0 ? (
          <Empty description="暂无重点标注" />
        ) : (
          <List
            dataSource={highlightPages}
            renderItem={(page) => {
              const pageHighlights = highlights.filter(h => h.pageIndex === page)
              return (
                <List.Item
                  onClick={() => {
                    goToPage(page)
                    setShowHighlights(false)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <List.Item.Meta
                    title={
                      <span>
                        第 {page} 页
                        {page === pageNumber && <Tag color="blue" style={{ marginLeft: 8 }}>当前页</Tag>}
                      </span>
                    }
                    description={`${pageHighlights.length} 处重点标注`}
                  />
                </List.Item>
              )
            }}
          />
        )}
      </Drawer>

      {/* 页码列表抽屉 */}
      <Drawer
        title="快速跳转"
        placement="bottom"
        onClose={() => setShowPageList(false)}
        open={showPageList}
        height="50%"
      >
        <div className="page-grid">
          {Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
            <div
              key={page}
              className={`page-grid-item ${page === pageNumber ? 'active' : ''} ${highlightPages.includes(page) ? 'has-highlight' : ''}`}
              onClick={() => goToPage(page)}
            >
              {page}
              {highlightPages.includes(page) && <span className="highlight-dot" />}
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  )
}

export default MobileLectureReader
