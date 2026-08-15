/**
 * Composants atomiques SARIS — barrel export.
 *
 * Tous les composants UI partagés (Card, Button, StatCard, Field, etc.)
 * sont accessibles via : import { Card, Button, … } from '@/components/saris'
 */

export { Card, CardComposite }            from './Card'
export type { CardProps }                 from './Card'

export { Button }                         from './Button'
export type { ButtonVariant, ButtonSize } from './Button'

export { IconButton }                     from './IconButton'
export type { IconButtonTone }            from './IconButton'

export { TILE_TONE_MAP }                  from './tones'
export type { Tone }                      from './tones'

export { Field, TextInput, Textarea }     from './Field'

export { CheckBox }                       from './CheckBox'

export { Modal }                          from './Modal'

export { PhotoCropModal }                 from './PhotoCropModal'

export { MotifDialog }                    from './MotifDialog'

export { Tooltip }                        from './Tooltip'

export { StatusPill }                     from './StatusPill'
export type { StatusTone }                from './StatusPill'

export { EmptyState }                     from './EmptyState'
export { InfoSection, InfoRow }           from './InfoRow'
export { Skeleton }                       from './Skeleton'
export { PageHeader }                     from './PageHeader'
export { Toolbar }                        from './Toolbar'
export { StatCard }                       from './StatCard'
export { Avatar }                         from './Avatar'
export { UserAvatar }                     from './UserAvatar'

export { SelectBox }                      from './SelectBox'
export type { SelectOption, SelectGroupDef } from './SelectBox'

export { DatePicker }                     from './DatePicker'

export { SegmentedTabs }                  from './SegmentedTabs'
export type { SegmentedTab }              from './SegmentedTabs'

export { TotpCountdown }                   from './TotpCountdown'

export { PaginationBar }                  from './Pagination'

export { DataTableHead, dataRowStyle, dataRowBackground, DATA_TABLE_CARD, DATA_TABLE_MINW, DATA_TD_PADDING } from './DataTable'
export type { DataColumn }                 from './DataTable'

export { useColumnResize }                 from './useColumnResize'
export type { ColumnResize }               from './useColumnResize'

export { AreaTrend, MiniBars, DonutChart, RankedBars, SparkLine, CHART_PALETTE } from './Charts'
export type { AreaSeries, DonutSlice, RankedBarRow } from './Charts'

export { LiveDuration }                    from './LiveDuration'
