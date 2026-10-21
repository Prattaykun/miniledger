import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  frame: '#E7E0D2',
  paper: '#F4EFE6',
  card: '#FFFDF8',
  ink: '#1E2430',
  muted: '#6E675E',
  line: '#E4D9C8',
  green: '#1B6B45',
  greenSoft: '#E7F3EC',
  overdue: '#9C3412',
  overdueSoft: '#FDE7E0',
  white: '#FFFFFF',
  danger: '#9C3412',
};

export const serif: TextStyle['fontFamily'] = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Iowan Old Style", Palatino, serif',
  default: 'serif',
});

export const card: ViewStyle = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 16,
  padding: 16,
};
