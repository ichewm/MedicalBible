/**
 * @file PC端讲义阅读器
 * @description 传统PDF阅读器，带侧边栏重点索引
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Spin, Empty, Button, Space, message } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Document, Page, pdfjs } from 'react-pdf'
import { getLectureDetail, getHighlights, updateProgress, type Lecture, type Highlight } from '@/api/lecture'
import { getFileUrl } from '@/utils/file'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const PCLectureReader = () => {
  const { id } = useParams()
  const [lecture, setLecture] = useState<Lecture>()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(false)
  
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  
  const saveProgressTimer = useRef<NodeJS.Timeout | null>(null)
  const lastSavedPage = useRef<number>(0)

  // 保存阅读进度 (防抖)
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
    }, 1000)
  }, [id])

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
          message.info(`已恢复到第 ${data.lastPage} 页`)
        }
        
        // 单独加载重点标注，失败时不影响讲义显示
        try {
          const highlightsData: any = await getHighlights(Number(id))
          setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData.items || [])
        } catch (highlightError) {
          console.error('加载重点标注失败:', highlightError)
        }
      } catch (error) {
        console.error(error)
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

  useEffect(() => {
    if (pageNumber > 0 && numPages > 0) {
      saveProgress(pageNumber)
    }
  }, [pageNumber, numPages, saveProgress])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1))
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages, prev + 1))

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!lecture) return <Empty description="讲义不存在" />

  const currentHighlights = highlights.filter(h => h.pageIndex === pageNumber)

  return (
    <div style={{ 
      height: 'calc(100vh - 100px)', 
      display: 'flex', 
      flexDirection: 'row' 
    }}>
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <Card 
          title={lecture.title} 
          styles={{ body: { padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' } }}
          style={{ width: '100%', maxWidth: 1000 }}
        >
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button 
                disabled={pageNumber <= 1} 
                onClick={goToPrevPage}
                icon={<LeftOutlined />}
              >
                上一页
              </Button>
              <span>
                第 {pageNumber} 页 / 共 {numPages || '--'} 页
              </span>
              <Button 
                disabled={pageNumber >= numPages} 
                onClick={goToNextPage}
                icon={<RightOutlined />}
              >
                下一页
              </Button>
            </Space>
          </div>

          <div style={{ border: '1px solid var(--border-color-secondary)', position: 'relative' }}>
            <Document
              file={getFileUrl(lecture.fileUrl)}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<Spin tip="加载 PDF..." />}
              error={<Empty description="PDF 加载失败" />}
            >
              <Page 
                pageNumber={pageNumber} 
                width={800}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
            
            {/* 重点标注层 */}
            {currentHighlights.map((h) => (
              (Array.isArray(h.data) ? h.data : []).map((rect: any, idx: number) => (
                <div
                  key={`${h.id}-${idx}`}
                  style={{
                    position: 'absolute',
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.w}%`,
                    height: `${rect.h}%`,
                    backgroundColor: rect.color || '#FFFF00',
                    opacity: 0.4,
                    pointerEvents: 'none',
                  }}
                />
              ))
            ))}
          </div>
        </Card>
      </div>
      
      {/* 侧边栏重点索引 */}
      <div style={{ 
        width: 300, 
        background: 'var(--card-bg)', 
        padding: 16, 
        borderLeft: '1px solid var(--border-color-secondary)',
        overflowY: 'auto'
      }}>
        <h3>重点索引</h3>
        {highlights.length > 0 ? (
          <div>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>共 {highlights.length} 页有重点标注</p>
            {highlights.map(h => (
              <Button 
                key={h.id} 
                type={h.pageIndex === pageNumber ? 'primary' : 'default'}
                size="small"
                style={{ margin: '0 8px 8px 0' }}
                onClick={() => setPageNumber(h.pageIndex)}
              >
                第 {h.pageIndex} 页
              </Button>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无重点标注" />
        )}
      </div>
    </div>
  )
}

export default PCLectureReader
