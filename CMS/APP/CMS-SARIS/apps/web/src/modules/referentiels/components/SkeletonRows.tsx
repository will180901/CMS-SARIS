import { Skeleton } from '@workspace/ui/components/skeleton'

interface SkeletonRowsProps {
  rows?:    number
  cols?:    number
  /** Largeurs relatives des colonnes (0–1), ex: [0.15, 0.4, 0.3, 0.15] */
  widths?:  number[]
}

export function SkeletonRows({ rows = 7, cols = 4, widths }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--bordure-legere)' }}>
          {Array.from({ length: cols }).map((_, j) => {
            const w = widths?.[j]
            return (
              <td key={j} style={{ padding: '12px 16px' }}>
                <Skeleton
                  className="h-4 rounded-sm"
                  style={{
                    width:   w ? `${Math.round(w * 100)}%` : j === 0 ? '30%' : j === cols - 1 ? '20%' : '70%',
                    opacity: 1 - i * 0.07,
                  }}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
