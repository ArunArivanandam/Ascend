import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  /** Primary action and the avatar. */
  accent: string;
  onAccent: string;
  /** Mountain body, snow cap and sky. */
  rock: string;
  rockShade: string;
  snow: string;
  sky: string;
  route: string;
  success: string;
  danger: string;
}

export const lightPalette: Palette = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  border: '#DCE3EC',
  text: '#13212F',
  textMuted: '#5B6B7C',
  accent: '#1F7AE0',
  onAccent: '#FFFFFF',
  rock: '#5D7187',
  rockShade: '#465870',
  snow: '#FFFFFF',
  sky: '#DCEBFA',
  route: '#F2B84B',
  success: '#1E9E6A',
  danger: '#C2413B',
};

export const darkPalette: Palette = {
  background: '#0E151D',
  surface: '#17212C',
  border: '#263443',
  text: '#EEF3F8',
  textMuted: '#93A3B5',
  accent: '#4C9BF5',
  onAccent: '#06121F',
  rock: '#4A5D73',
  rockShade: '#394A5E',
  snow: '#E8EEF5',
  sky: '#15222F',
  route: '#F2B84B',
  success: '#3CC38B',
  danger: '#EF6A63',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? darkPalette : lightPalette;
}
