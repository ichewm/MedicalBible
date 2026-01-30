/**
 * @file 讲义预览组件（含重点标注显示）
 */

import { useEffect, useState, useRef } from 'react'
import { Modal, Spin, Empty, Button, Space, Typography, Tag, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Document, Page, pdfjs } from 'react-pdf'
import { getTeacherHighlights } from '@/api/lecture'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const { Text } = Typography

interface HighlightRect {
  x: number
  y: number
  w: number
  h: number
  color: string
}

interface HighlightData {
  id: number
  pageIndex: number
  data: HighlightRect[] | { rects: HighlightRect[] }
  teacherId?: number
  teacherName?: string
  createdAt: string
}

interface LecturePreviewProps {
  open: boolean
  onClose: () => void
  lectureId: number
  title: string
  pdfUrl: string
  pageCount: number
}

const LecturePreview = ({ open, onClose, lectureId, title, pdfUrl, pageCount }: LecturePreviewProps) => {
  const [loading, setLoading] = useState(false)
  const [highlights, setHighlights] = useState<HighlightData[]>([])
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const pageRef = useRef<HTMLDivElement>(null)
  const pdfWidth = 800
  const opacity = 40

  // 加载重点标注
  useEffect(() => {
    if (open && lectureId) {
      const fetchHighlights = async () => {
        setLoading(true)
        try {
          const data: any = await getTeacherHighlights(lectureId)
          setHighlights(Array.isArray(data) ? data : data.items || [])
        } catch (error) {
          console.error(error)
        } finally {
          setLoading(false)
        }
      }
      fetchHighlights()
      setPageNumber(1)
    }
  }, [open, lectureId])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // 获取当前页的重点
  const currentHighlight = highlights.find(h => h.pageIndex === pageNumber)
  const currentRects: HighlightRect[] = currentHighlight?.data
    ? (Array.isArray(currentHighlight.data) ? currentHighlight.data : currentHighlight.data.rects || [])
    : []

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return (
    <Modal
      title={
        <Space>
          <span>{title}</span>
          {currentHighlight && (
            <Tag color="blue">
              本页有 {currentRects.length} 个重点标注
            </Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* 翻页控制 */}
        <div style={{ marginBottom: 12, textAlign: 'center' }}>
          <Space>
            <Button 
              disabled={pageNumber <= 1} 
              onClick={() => setPageNumber(prev => prev - 1)}
              icon={<LeftOutlined />}
            />
            <span>第 {pageNumber} 页 / 共 {numPages || pageCount} 页</span>
            <Button 
              disabled={pageNumber >= (numPages || pageCount)} 
              onClick={() => setPageNumber(prev => prev + 1)}
              icon={<RightOutlined />}
            />
          </Space>
        </div>

        {/* 标注信息 */}
        {currentHighlight && (
          <div style={{ marginBottom: 8, textAlign: 'center' }}>
            <Text type="secondary">
              标注于 {formatTime(currentHighlight.createdAt)}
              {currentHighlight.teacherName && ` · 标注人: ${currentHighlight.teacherName}`}
            </Text>
          </div>
        )}

        {/* PDF + 重点标注 */}
        <div 
          style={{ 
            position: 'relative', 
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'center',
            background: 'var(--fill-secondary)'
          }}
        >
          <div ref={pageRef} style={{ position: 'relative' }}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<Spin tip="加载 PDF..." style={{ padding: 100 }} />}
              error={<Empty description="PDF 加载失败" />}
            >
              <Page 
                pageNumber={pageNumber} 
                width={pdfWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* 显示重点标注 */}
            {currentRects.map((rect, index) => (
              <Tooltip 
                key={index} 
                title={
                  <div>
                    <div>重点区域 {index + 1}</div>
                    {currentHighlight?.teacherName && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        标注人: {currentHighlight.teacherName}
                      </div>
                    )}
                    {currentHighlight?.createdAt && (
                      <div style={{ fontSize: 12, color: '#aaa' }}>
                        {formatTime(currentHighlight.createdAt)}
                      </div>
                    )}
                  </div>
                }
                placement="top"
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.w}%`,
                    height: `${rect.h}%`,
                    backgroundColor: rect.color,
                    opacity: opacity / 100,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
              </Tooltip>
            ))}
          </div>
        </div>

        {/* 快速跳转到有标注的页面 */}
        {highlights.length > 0 && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Text type="secondary" style={{ marginRight: 8 }}>有标注的页面：</Text>
            <Space wrap>
              {highlights.map(h => (
                <Tag 
                  key={h.id}
                  color={h.pageIndex === pageNumber ? 'blue' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPageNumber(h.pageIndex)}
                >
                  第 {h.pageIndex} 页
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Spin>
    </Modal>
  )
}

export default LecturePreview
