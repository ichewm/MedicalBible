/**
 * @file 教师画重点工具
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Spin, Empty, Button, Space, message, Popconfirm, ColorPicker, Slider, Typography, Divider, List, Tag, Modal, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined, SaveOutlined, DeleteOutlined, ClearOutlined, ArrowLeftOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Document, Page, pdfjs } from 'react-pdf'
import { getTeacherLectureDetail, getTeacherHighlights, createHighlight, deleteHighlight, type Lecture, type Highlight } from '@/api/lecture'
import { getFileUrl } from '@/utils/file'
import { logger } from '@/utils'

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

const HighlightEditor = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lecture, setLecture] = useState<Lecture>()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // PDF 状态
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const pdfWidth = 800
  
  // 绘制状态
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<HighlightRect | null>(null)
  const [drawnRects, setDrawnRects] = useState<HighlightRect[]>([])
  const [highlightColor, setHighlightColor] = useState('#FFFF00')
  const [opacity, setOpacity] = useState(40)
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  
  // 跟踪原始数据，用于判断是否有修改
  const [originalRects, setOriginalRects] = useState<HighlightRect[]>([])
  const hasUnsavedChanges = JSON.stringify(drawnRects) !== JSON.stringify(originalRects)

  // 加载讲义和重点
  useEffect(() => {
    const init = async () => {
      if (!id) return
      setLoading(true)
      try {
        const data: any = await getTeacherLectureDetail(Number(id))
        setLecture(data)
        
        const highlightsData: any = await getTeacherHighlights(Number(id))
        setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData.items || [])
      } catch (error) {
        logger.error('加载讲义失败', error)
        message.error('加载讲义失败')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  // 加载当前页的重点
  const currentHighlight = highlights.find(h => h.pageIndex === pageNumber)
  
  useEffect(() => {
    if (currentHighlight && currentHighlight.data) {
      // data 直接是数组，兼容旧格式 { rects: [...] }
      const rects = Array.isArray(currentHighlight.data) 
        ? currentHighlight.data 
        : (currentHighlight.data.rects || [])
      setDrawnRects(rects)
      setOriginalRects(rects)
    } else {
      setDrawnRects([])
      setOriginalRects([])
    }
  }, [pageNumber, highlights])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // 获取相对坐标
  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!pageRef.current) return { x: 0, y: 0 }
    const rect = pageRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    }
  }, [])

  // 开始绘制
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getRelativePos(e)
    setIsDrawing(true)
    setStartPos(pos)
    setCurrentRect({ x: pos.x, y: pos.y, w: 0, h: 0, color: highlightColor })
  }

  // 绘制中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return
    const pos = getRelativePos(e)
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      w: Math.abs(pos.x - startPos.x),
      h: Math.abs(pos.y - startPos.y),
      color: highlightColor
    })
  }

  // 结束绘制
  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) return
    setIsDrawing(false)
    
    // 只保存有效的矩形
    if (currentRect.w > 1 && currentRect.h > 1) {
      setDrawnRects(prev => [...prev, currentRect])
    }
    setCurrentRect(null)
  }

  // 删除单个矩形
  const handleDeleteRect = (index: number) => {
    setDrawnRects(prev => prev.filter((_, i) => i !== index))
  }

  // 清空当前页
  const handleClearPage = () => {
    setDrawnRects([])
  }

  // 保存当前页重点
  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      // 先删除当前页的旧标注
      const existingHighlight = highlights.find(h => h.pageIndex === pageNumber)
      if (existingHighlight) {
        await deleteHighlight(existingHighlight.id)
      }
      
      // 如果有新标注，创建
      if (drawnRects.length > 0) {
        await createHighlight(Number(id), {
          pageIndex: pageNumber,
          data: drawnRects
        })
      }
      
      // 刷新重点列表
      const highlightsData: any = await getTeacherHighlights(Number(id))
      setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData.items || [])

      message.success('保存成功')
      setOriginalRects([...drawnRects])
    } catch (error) {
      logger.error('保存失败', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 页面切换处理（带未保存提醒）
  const handlePageChange = (newPage: number) => {
    // 检查当前是否有未保存的修改
    const currentHasChanges = JSON.stringify(drawnRects) !== JSON.stringify(originalRects)
    
    if (currentHasChanges) {
      Modal.confirm({
        title: '有未保存的修改',
        icon: <ExclamationCircleOutlined />,
        content: '当前页面有未保存的重点标注，请选择操作：',
        okText: '保存并切换',
        cancelText: '不保存，直接切换',
        closable: true,
        maskClosable: true,
        onOk: async () => {
          // 保存当前页
          await handleSave()
          setPageNumber(newPage)
        },
        onCancel: () => {
          // 放弃修改，直接切换
          setDrawnRects(originalRects)
          setPageNumber(newPage)
        },
      })
    } else {
      setPageNumber(newPage)
    }
  }

  // 删除当前页全部重点
  const handleDeletePageHighlights = async () => {
    const existingHighlight = highlights.find(h => h.pageIndex === pageNumber)
    if (!existingHighlight) return
    
    try {
      await deleteHighlight(existingHighlight.id)
      setDrawnRects([])
      setHighlights(prev => prev.filter(h => h.id !== existingHighlight.id))
      message.success('已删除')
    } catch (error) {
      logger.error('删除标注失败', error)
    }
  }

  // 跳转到有标注的页面
  const goToHighlightPage = (pageIndex: number) => {
    handlePageChange(pageIndex)
  }

  // 返回列表（带未保存提醒）
  const handleBack = () => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: '有未保存的修改',
        icon: <ExclamationCircleOutlined />,
        content: '当前页面有未保存的重点标注，确定要离开吗？',
        okText: '保存并离开',
        cancelText: '直接离开',
        onOk: async () => {
          await handleSave()
          navigate('/teacher')
        },
        onCancel: () => {
          navigate('/teacher')
        },
      })
    } else {
      navigate('/teacher')
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!lecture) return <Empty description="讲义不存在" />

  // 有重点的页面列表
  const highlightedPages = highlights.map(h => h.pageIndex).sort((a, b) => a - b)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
      {/* 左侧工具栏 */}
      <div style={{ width: 260, padding: 16, borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 16 }}>
          返回列表
        </Button>
        
        {hasUnsavedChanges && (
          <Tag color="warning" style={{ marginBottom: 16, display: 'block' }}>
            ⚠️ 有未保存的修改
          </Tag>
        )}
        
        <Divider orientation="left">画笔设置</Divider>
        
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">颜色</Text>
          <div style={{ marginTop: 8 }}>
            <ColorPicker 
              value={highlightColor} 
              onChange={(_, hex) => setHighlightColor(hex)}
              presets={[
                { label: '常用', colors: ['#FFFF00', '#00FF00', '#FF6B6B', '#4DABF7', '#F783AC'] }
              ]}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">透明度: {opacity}%</Text>
          <Slider 
            value={opacity} 
            onChange={setOpacity}
            min={20}
            max={80}
          />
        </div>

        <Divider orientation="left">当前页操作</Divider>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={saving}
            block
          >
            保存当前页
          </Button>
          <Button 
            icon={<ClearOutlined />} 
            onClick={handleClearPage}
            disabled={drawnRects.length === 0}
            block
          >
            清空画布
          </Button>
          <Popconfirm
            title="确定删除当前页所有重点？"
            onConfirm={handleDeletePageHighlights}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              danger 
              icon={<DeleteOutlined />}
              disabled={!highlights.find(h => h.pageIndex === pageNumber)}
              block
            >
              删除已保存
            </Button>
          </Popconfirm>
        </Space>

        <Divider orientation="left">重点索引</Divider>
        
        {highlightedPages.length > 0 ? (
          <List
            size="small"
            dataSource={highlightedPages}
            renderItem={(page) => (
              <List.Item 
                style={{ cursor: 'pointer', padding: '8px 12px' }}
                onClick={() => goToHighlightPage(page)}
              >
                <Tag color={page === pageNumber ? 'blue' : 'default'}>第 {page} 页</Tag>
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">暂无重点标注</Text>
        )}
      </div>

      {/* 中间 PDF 区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, overflow: 'auto' }}>
        <Card 
          title={lecture.title} 
          size="small"
          style={{ width: '100%', maxWidth: pdfWidth + 48 }}
          bodyStyle={{ padding: 12 }}
        >
          {/* 翻页控制 */}
          <div style={{ marginBottom: 12, textAlign: 'center' }}>
            <Space>
              <Button 
                disabled={pageNumber <= 1} 
                onClick={() => handlePageChange(pageNumber - 1)}
                icon={<LeftOutlined />}
              />
              <span>第 {pageNumber} 页 / 共 {numPages || lecture.pageCount} 页</span>
              <Button 
                disabled={pageNumber >= (numPages || lecture.pageCount)} 
                onClick={() => handlePageChange(pageNumber + 1)}
                icon={<RightOutlined />}
              />
            </Space>
          </div>

          {/* PDF + 绘制层 */}
          <div 
            ref={canvasRef}
            style={{ 
              position: 'relative', 
              border: '1px solid var(--border-color)',
              cursor: 'crosshair',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div ref={pageRef}>
              <Document
                file={getFileUrl((lecture as any).fileUrl || lecture.pdfUrl)}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Spin tip="加载 PDF..." />}
                error={<Empty description="PDF 加载失败" />}
              >
                <Page 
                  pageNumber={pageNumber} 
                  width={pdfWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>

            {/* 已保存的重点 */}
            {drawnRects.map((rect, index) => (
              <Tooltip
                key={index}
                title={
                  currentHighlight ? (
                    <div>
                      <div>区域 {index + 1}</div>
                      {currentHighlight.teacherName && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          标注人: {currentHighlight.teacherName}
                        </div>
                      )}
                    </div>
                  ) : `区域 ${index + 1}`
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

            {/* 正在绘制的矩形 */}
            {currentRect && (
              <div
                style={{
                  position: 'absolute',
                  left: `${currentRect.x}%`,
                  top: `${currentRect.y}%`,
                  width: `${currentRect.w}%`,
                  height: `${currentRect.h}%`,
                  backgroundColor: currentRect.color,
                  opacity: opacity / 100,
                  pointerEvents: 'none',
                  border: '2px dashed rgba(0,0,0,0.3)',
                }}
              />
            )}
          </div>

          {/* 当前页标注列表 */}
          {drawnRects.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                本页标注 ({drawnRects.length}个)
                {currentHighlight?.teacherName && ` · 标注人: ${currentHighlight.teacherName}`}
              </Text>
              <Space wrap style={{ marginTop: 8 }}>
                {drawnRects.map((rect, index) => (
                  <Tag 
                    key={index} 
                    closable 
                    onClose={() => handleDeleteRect(index)}
                    style={{ backgroundColor: rect.color, opacity: 0.7 }}
                  >
                    区域 {index + 1}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default HighlightEditor
