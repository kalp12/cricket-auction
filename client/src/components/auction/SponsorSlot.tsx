import { assetUrl } from '../../api'

const POS_CLASSES: Record<string, string> = {
  'top-left': 'top-6 left-6',
  'top-right': 'top-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-right': 'bottom-6 right-6',
  'title-bar': 'top-3 left-1/2 -translate-x-1/2',
  'player-card': '',
}

interface Props {
  src?: string | null
  position: string
  maxHeight?: number
  maxWidth?: number
  className?: string
}

export default function SponsorSlot({ src, position, maxHeight = 60, maxWidth = 120, className = '' }: Props) {
  if (!src) return null
  const url = assetUrl(src)!
  const posClass = POS_CLASSES[position] || ''
  const isTitle = position === 'title-bar'
  const isPlayer = position === 'player-card'

  if (isPlayer) {
    return (
      <img
        src={url}
        alt="Sponsor"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        className={`inline-block align-middle ml-2 ${className}`}
        style={{ maxHeight: 40, maxWidth: 80, objectFit: 'contain' }}
      />
    )
  }

  return (
    <div className={`absolute ${posClass} z-10 ${className}`}>
      <img
        src={url}
        alt="Sponsor"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        style={{
          maxHeight: isTitle ? 50 : maxHeight,
          maxWidth: isTitle ? 400 : maxWidth,
          objectFit: 'contain',
          ...(isTitle ? { margin: '0 auto' } : {}),
        }}
      />
    </div>
  )
}
