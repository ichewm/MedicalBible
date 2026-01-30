/**
 * @file 讲义详情页面
 * @description PC端使用传统阅读器，移动端使用翻书式阅读器
 */

import { Grid } from 'antd'
import MobileLectureReader from './MobileLectureReader'
import PCLectureReader from './PCLectureReader'

const { useBreakpoint } = Grid

const LectureDetail = () => {
  const screens = useBreakpoint()
  const isMobile = !screens.md

  // 根据设备类型渲染不同的阅读器
  return isMobile ? <MobileLectureReader /> : <PCLectureReader />
}

export default LectureDetail
