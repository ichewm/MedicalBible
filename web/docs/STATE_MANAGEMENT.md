# State Management Guide

## Overview

The frontend application uses **Zustand** as its state management solution. Zustand is a lightweight, TypeScript-first state management library that provides a simple API for managing global application state with minimal boilerplate.

### Why Zustand?

- **Lightweight**: ~1KB gzipped, minimal bundle impact
- **No providers required**: Unlike Redux/Context, stores work without provider wrapping
- **Built-in TypeScript support**: First-class TypeScript experience
- **Persist middleware**: Easy localStorage persistence for offline support
- **DevTools integration**: Optional Redux DevTools support
- **Simple API**: Less boilerplate than Redux Toolkit

## Store Architecture

### Existing Stores

| Store | File | Purpose | Persistence |
|-------|------|---------|-------------|
| `useAuthStore` | `stores/auth.ts` | Authentication state (token, user, currentLevel) | Yes |
| `useThemeStore` | `stores/theme.ts` | Theme mode (light/dark/system) | Yes |
| `useVoiceStore` | `stores/voice.ts` | Voice recognition settings | Yes |

### New Stores (FEAT-003)

| Store | File | Purpose | Persistence | TTL |
|-------|------|---------|-------------|-----|
| `useContentStore` | `stores/content.ts` | Lectures, papers, category tree | Yes | 30 min |
| `useUserStore` | `stores/user.ts` | Subscriptions, practice stats, reading history | Yes | 5-10 min |
| `useCartStore` | `stores/cart.ts` | Subscription selection, payment preferences | Yes | N/A |

## Store Patterns

### Basic Store Structure

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MyState {
  // State
  data: any | null
  loading: boolean
  error: string | null

  // Actions
  fetchData: () => Promise<void>
  clearData: () => void
}

export const useMyStore = create<MyState>()(
  persist(
    (set, get) => ({
      // Initial state
      data: null,
      loading: false,
      error: null,

      // Actions
      fetchData: async () => {
        set({ loading: true, error: null })
        try {
          const result = await apiCall()
          set({ data: result, loading: false })
        } catch (error) {
          set({ loading: false, error: error.message })
        }
      },

      clearData: () => set({ data: null }),
    }),
    {
      name: 'my-app-storage', // localStorage key
      partialize: (state) => ({
        // Only persist specific fields
        data: state.data,
      }),
    }
  )
)
```

### Caching with TTL Pattern

For cached data, use the TTL (Time-To-Live) pattern:

```typescript
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface State {
  data: any | null
  loadedAt: number | null

  fetchData: async () => {
    const now = Date.now()
    const cachedAt = get().loadedAt

    // Check cache validity
    if (get().data && cachedAt && now - cachedAt < CACHE_TTL) {
      return get().data // Return cached data
    }

    // Fetch fresh data
    const result = await apiCall()
    set({ data: result, loadedAt: now })
    return result
  }
}
```

### Keyed Caching Pattern

For data keyed by ID (e.g., lectures by subject):

```typescript
interface State {
  itemsByKey: Record<number, Item[]>
  loadedAtByKey: Record<number, number>

  fetchItems: async (key: number) => {
    const cacheKey = `items-${key}`
    const now = Date.now()
    const cachedAt = get().loadedAtByKey[key]
    const cachedItems = get().itemsByKey[key]

    if (cachedItems && cachedAt && now - cachedAt < CACHE_TTL) {
      return cachedItems
    }

    const result = await apiCall(key)
    set({
      itemsByKey: { ...get().itemsByKey, [key]: result },
      loadedAtByKey: { ...get().loadedAtByKey, [key]: now },
    })
    return result
  }
}
```

## Using Stores in Components

### Basic Usage

```typescript
import { useContentStore } from '@/stores'

function MyComponent() {
  // Select specific values (prevents unnecessary re-renders)
  const categoryTree = useContentStore(state => state.categoryTree)
  const fetchCategoryTree = useContentStore(state => state.fetchCategoryTree)

  useEffect(() => {
    if (!categoryTree) {
      fetchCategoryTree()
    }
  }, [])

  return <div>{/* ... */}</div>
}
```

### Multiple Values

```typescript
// Select multiple values (will re-render on any change)
const { categoryTree, lecturesBySubject, fetchCategoryTree } = useContentStore()
```

### Loading States

```typescript
const loading = useContentStore(state => state.loading['categoryTree'])
const error = useContentStore(state => state.errors['categoryTree'])

if (loading) return <Spin />
if (error) return <Alert message={error} type="error" />
```

## Store Descriptions

### useAuthStore

Manages authentication state.

```typescript
interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  currentLevelId: number | null

  setAuth: (token: string, refreshToken: string, user: User) => void
  setUser: (user: User) => void
  setCurrentLevel: (levelId: number) => void
  logout: () => void
}
```

**Usage:**

```typescript
const { token, user, setCurrentLevel } = useAuthStore()
```

### useContentStore

Manages content data (lectures, papers, category tree) with caching.

```typescript
interface ContentState {
  categoryTree: Profession[] | null
  categoryTreeLoadedAt: number | null
  lecturesBySubject: Record<number, Lecture[]>
  lecturesLoadedAt: Record<number, number>
  papersBySubject: Record<number, Paper[]>
  papersLoadedAt: Record<number, number>
  loading: Record<string, boolean>
  errors: Record<string, string | null>

  fetchCategoryTree: () => Promise<Profession[]>
  fetchLectures: (subjectId: number) => Promise<Lecture[]>
  fetchPapers: (subjectId: number) => Promise<Paper[]>
  invalidateContent: (key?: string) => void
  clearErrors: () => void
}
```

**Usage:**

```typescript
const { categoryTree, fetchCategoryTree } = useContentStore()

useEffect(() => {
  if (!categoryTree) {
    fetchCategoryTree()
  }
}, [])
```

**Cache Invalidation:**

```typescript
// Invalidate all content
invalidateContent()

// Invalidate specific cache
invalidateContent('categoryTree')
invalidateContent('lectures-1')  // subject ID 1
invalidateContent('papers-2')    // subject ID 2
```

### useUserStore

Manages user-specific data with shorter TTL.

```typescript
interface UserState {
  subscriptions: any[]
  subscriptionsLoadedAt: number | null
  practiceStats: UserPracticeStats | null
  statsLoadedAt: number | null
  readingHistory: Lecture[] | null
  historyLoadedAt: number | null
  loading: Record<string, boolean>
  errors: Record<string, string | null>

  fetchSubscriptions: () => Promise<any[]>
  fetchPracticeStats: () => Promise<UserPracticeStats>
  fetchReadingHistory: () => Promise<Lecture[]>
  invalidateUserData: (key?: string) => void
  clearErrors: () => void
}
```

**Usage:**

```typescript
const { subscriptions, fetchSubscriptions, practiceStats, fetchPracticeStats } = useUserStore()

useEffect(() => {
  fetchSubscriptions()
  fetchPracticeStats()
}, [])
```

### useCartStore

Manages subscription purchase flow.

```typescript
interface CartState {
  selectedLevelId: number | null
  selectedPriceId: number | null
  selectedPrice: SkuPrice | null
  preferredPaymentMethod: PaymentMethod | null

  setSelectedLevel: (levelId: number | null) => void
  setSelectedPrice: (price: SkuPrice | null) => void
  setPaymentMethod: (method: PaymentMethod | null) => void
  clearCart: () => void
  hasItems: () => boolean
}
```

**Usage:**

```typescript
const { selectedPrice, setSelectedPrice, hasItems } = useCartStore()

const handleBuyClick = (price: SkuPrice) => {
  setSelectedPrice(price)
}

if (hasItems()) {
  // Show checkout
}
```

### useThemeStore

Manages application theme.

```typescript
interface ThemeState {
  mode: 'light' | 'dark' | 'system'
  resolvedTheme: 'light' | 'dark'

  setMode: (mode: ThemeMode) => void
  initTheme: () => void
}
```

### useVoiceStore

Manages voice recognition settings.

```typescript
interface VoiceState {
  enabled: boolean
  textToSpeechEnabled: boolean
  listeningMode: 'push-to-talk' | 'continuous'
  volume: number
  language: string
  showInterim: boolean
  showErrorTips: boolean

  toggleEnabled: () => void
  setEnabled: (enabled: boolean) => void
  // ... more setters
}
```

## Testing Guidelines

### Unit Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMyStore } from '@/stores/my-store'

// Mock dependencies
vi.mock('@/api/...', () => ({
  apiFunction: vi.fn(),
}))

describe('useMyStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMyStore.setState({
      data: null,
      loading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  describe('Initial state', () => {
    it('should initialize with empty state', () => {
      const state = useMyStore.getState()
      expect(state.data).toBeNull()
    })
  })

  describe('Actions', () => {
    it('should fetch data successfully', async () => {
      const mockData = { id: 1, name: 'Test' }
      vi.mocked(apiFunction).mockResolvedValue(mockData)

      const result = await useMyStore.getState().fetchData()

      expect(result).toEqual(mockData)
      expect(useMyStore.getState().data).toEqual(mockData)
    })
  })
})
```

### Test Coverage Requirements

- Test initial state
- Test all actions (happy path)
- Test error handling
- Test caching behavior (TTL)
- Test cache invalidation

## Migration Guide

### From useState + useEffect

**Before:**

```typescript
const [data, setData] = useState([])
const [loading, setLoading] = useState(false)

useEffect(() => {
  const fetchData = async () => {
    setLoading(true)
    const result = await apiCall()
    setData(result)
    setLoading(false)
  }
  fetchData()
}, [])
```

**After:**

```typescript
const { data, loading, fetchData } = useMyStore()

useEffect(() => {
  if (!data) {
    fetchData()
  }
}, [])
```

### From Context API

Zustand stores can coexist with Context. Gradually migrate by:

1. Create the Zustand store
2. Update components one at a time
3. Remove old Context provider once all consumers migrated

## Best Practices

1. **Select Specific Values**: Use selector functions to prevent unnecessary re-renders
   ```typescript
   const data = useStore(state => state.data)  // Good
   const { data, other1, other2, other3 } = useStore()  // May cause extra re-renders
   ```

2. **Persist Only What's Needed**: Use `partialize` to avoid storing transient state

3. **Handle Errors Appropriately**: Store error messages for display, don't swallow them

4. **Cache Invalidation**: Provide methods to invalidate caches when data changes

5. **Keep Stores Focused**: One responsibility per store (auth, content, cart, etc.)

6. **Type Everything**: Leverage TypeScript for better developer experience

## Persistence Strategy

All stores use `zustand/persist` middleware with localStorage:

- **Storage key**: `medical-bible-{store-name}`
- **Partial persistence**: Loading and error states are NOT persisted
- **Migration**: If schema changes, increment version in persist config

Example of versioned migration:

```typescript
persist(
  (set) => ({ /* ... */ }),
  {
    name: 'medical-bible-cart',
    version: 1,
    migrate: (persistedState: any, version: number) => {
      if (version === 0) {
        // Migrate from v0 to v1
        return {
          ...persistedState,
          newField: defaultValue,
        }
      }
      return persistedState
    },
  }
)
```

## Performance Considerations

1. **Selector Functions**: Zustand only re-renders when selected values change
2. **Shallow Comparison**: For objects/arrays, consider `shallow` compare from zustand
3. **Batch Updates**: Multiple `set()` calls in same callback are batched

## Further Reading

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand Persist Middleware](https://github.com/pmndrs/zustand#persist-middleware)
- [React State Management Comparison](https://blog.logrocket.com/zustand-vs-react-state-management-libraries/)
