/**
 * @file Logo 组件
 * @description 支持亮色/暗色模式、多尺寸的 Logo 组件
 */

import { theme } from 'antd'

interface LogoProps {
  /** 是否折叠（仅显示图标） */
  collapsed?: boolean
  /** 尺寸：small=移动端头部, medium=侧边栏, large=登录页 */
  size?: 'small' | 'medium' | 'large'
  /** 是否只显示图标 */
  iconOnly?: boolean
  /** 自定义样式 */
  style?: React.CSSProperties
}

const Logo: React.FC<LogoProps> = ({ 
  collapsed = false, 
  size = 'medium',
  iconOnly = false,
  style 
}) => {
  const { token } = theme.useToken()
  
  // 根据主题获取颜色
  const isDark = token.colorBgContainer === '#141414' || 
                 document.documentElement.getAttribute('data-theme') === 'dark'
  
  const primaryColor = token.colorPrimary || '#1677ff'
  const successColor = token.colorSuccess || '#52c41a'
  const textColor = isDark ? '#ffffff' : '#1f1f1f'
  const subTextColor = isDark ? '#8c8c8c' : '#8c8c8c'
  
  // 尺寸配置
  const sizeConfig = {
    small: { icon: 24, fontSize: 14, subFont: 0, gap: 6 },
    medium: { icon: 32, fontSize: 18, subFont: 10, gap: 8 },
    large: { icon: 48, fontSize: 24, subFont: 12, gap: 12 },
  }
  
  const config = sizeConfig[size]
  const showText = !collapsed && !iconOnly

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: config.gap,
        ...style 
      }}
    >
      {/* SVG 图标 */}
      <svg 
        viewBox="0 0 32 32" 
        width={config.icon} 
        height={config.icon}
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id={`bookGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="1" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id={`crossGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={successColor} stopOpacity="1" />
            <stop offset="100%" stopColor={successColor} stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* 书本 */}
        <path 
          d="M4 8 L16 4 L28 8 L28 26 L16 30 L4 26 Z" 
          fill={`url(#bookGrad-${size})`}
        />
        {/* 书脊 */}
        <path 
          d="M16 4 L16 30" 
          stroke={isDark ? '#ffffff' : '#ffffff'} 
          strokeWidth="1" 
          opacity="0.5"
        />
        {/* 书页纹理 */}
        <path d="M6 10 L14 7" stroke="#fff" strokeWidth="0.5" opacity="0.3"/>
        <path d="M6 14 L14 11" stroke="#fff" strokeWidth="0.5" opacity="0.3"/>
        <path d="M18 7 L26 10" stroke="#fff" strokeWidth="0.5" opacity="0.3"/>
        <path d="M18 11 L26 14" stroke="#fff" strokeWidth="0.5" opacity="0.3"/>
        {/* 医学十字 */}
        <rect x="12" y="14" width="8" height="10" rx="1" fill={`url(#crossGrad-${size})`}/>
        <rect x="10" y="17" width="12" height="4" rx="1" fill={`url(#crossGrad-${size})`}/>
        {/* 高光 */}
        <rect x="12.5" y="14.5" width="7" height="1" rx="0.5" fill="#fff" opacity="0.4"/>
      </svg>
      
      {/* 文字 */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span 
            style={{ 
              fontSize: config.fontSize, 
              fontWeight: 600, 
              color: textColor,
              whiteSpace: 'nowrap',
            }}
          >
            医学宝典
          </span>
          {size === 'large' && (
            <span 
              style={{ 
                fontSize: config.subFont, 
                color: subTextColor,
                letterSpacing: '0.5px',
              }}
            >
              Medical Bible
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default Logo
