/**
 * @file Loading skeleton component for Suspense fallbacks
 * @description Provides consistent loading states across lazy-loaded routes
 */

import { Skeleton, Card } from 'antd'
import { Grid } from 'antd'

const { useBreakpoint } = Grid

interface LoadingSkeletonProps {
  type?: 'list' | 'card' | 'table' | 'form'
  count?: number
}

export const LoadingSkeleton = ({ type = 'card', count = 6 }: LoadingSkeletonProps) => {
  const screens = useBreakpoint()
  const isMobile = !screens.md

  if (type === 'list') {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: count }} />
      </Card>
    )
  }

  if (type === 'card') {
    const gridCount = isMobile ? 1 : 4
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCount}, 1fr)`, gap: 16 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <Skeleton.Image active />
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>
    )
  }

  // Default loading state
  return <Skeleton active />
}

export default LoadingSkeleton
