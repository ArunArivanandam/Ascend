import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { usePalette } from '@/theme/colors';

type IconName = 'mountain' | 'plan' | 'settings';

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'mountain' && <Path d="M2 20 9.5 6l4 7 2.5-4L22 20Z" fill={color} />}
      {name === 'plan' && (
        <>
          <Path d="M9 6h11M9 12h11M9 18h11" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={4.5} cy={6} r={1.5} fill={color} />
          <Circle cx={4.5} cy={12} r={1.5} fill={color} />
          <Circle cx={4.5} cy={18} r={1.5} fill={color} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path
            d="M4 7h8M18 7h2M4 17h2M12 17h8"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={15} cy={7} r={2.5} stroke={color} strokeWidth={2} />
          <Circle cx={9} cy={17} r={2.5} stroke={color} strokeWidth={2} />
        </>
      )}
    </Svg>
  );
}

const icon = (name: IconName) =>
  function Icon({ color, size }: { color: ColorValue; size: number }) {
    return <TabIcon name={name} color={color} size={size} />;
  };

/** Bottom tab bar: Mountain (today), Plan (Divide, Add, Subtract) and Settings. */
export function AppTabs() {
  const palette = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mountain',
          tabBarIcon: icon('mountain'),
          tabBarButtonTestID: 'tab-mountain',
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: 'Plan', tabBarIcon: icon('plan'), tabBarButtonTestID: 'tab-plan' }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: icon('settings'),
          tabBarButtonTestID: 'tab-settings',
        }}
      />
    </Tabs>
  );
}
