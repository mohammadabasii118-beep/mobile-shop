import type { ArtKey } from '../../data/products'
import IPhoneArt from './IPhoneArt'
import CaseArt from './CaseArt'
import GlassArt from './GlassArt'
import AdapterArt from './AdapterArt'
import CableArt from './CableArt'
import PowerBankArt from './PowerBankArt'
import AirPodsArt from './AirPodsArt'

interface ProductArtProps {
  art: ArtKey
  className?: string
  color?: string
}

/** Resolves an art key to the matching high-detail vector render. */
export default function ProductArt({ art, className, color }: ProductArtProps) {
  switch (art) {
    case 'iphone':
      return <IPhoneArt className={className} />
    case 'case':
      return <CaseArt className={className} color={color} />
    case 'glass':
      return <GlassArt className={className} />
    case 'adapter':
      return <AdapterArt className={className} />
    case 'cable':
      return <CableArt className={className} color={color} />
    case 'powerbank':
      return <PowerBankArt className={className} color={color} />
    case 'airpods':
      return <AirPodsArt className={className} />
    default:
      return null
  }
}
