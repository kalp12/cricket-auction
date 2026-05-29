import { assetUrl } from '../../api'

const POS_CLASSES: Record<string, string> = {
  'top-left': 'top-6 left-6',
  'top-right': 'top-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-right': 'bottom-6 right-6',
}

interface Props {
  src?: string | null
  position: string
  maxHeight?: number
  maxWidth?: number
}

export default function SponsorSlot({ src, position, maxHeight = 60, maxWidth = 120 }: Props) {
  if (!src) return null
  const url = assetUrl(src)!
  return (
    <div className={`absolute ${POS_CLASSES[position]} z-10`}>
      <img
        src={url}
        alt="Sponsor"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        style={{ maxHeight, maxWidth }}
      />
    </div>
  )
}
