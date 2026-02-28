import { ActivityIndicator } from 'react-native'
import { ScreenContainer } from './ScreenContainer'
import { colors } from '../../lib/theme'

export function LoadingScreen() {
  return (
    <ScreenContainer center>
      <ActivityIndicator color={colors.inkGhost} />
    </ScreenContainer>
  )
}
