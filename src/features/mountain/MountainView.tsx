import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline } from 'react-native-svg';

import { usePalette } from '@/theme/colors';

import { pointAlong, ROUTE_POINTS } from './route-geometry';

interface Props {
  /** Avatar position on the route, 0 (base) to 1 (summit). */
  avatarProgress: number;
  /** Route progress at which each intermediate camp sits. */
  campMarkers?: readonly number[];
  /** Shown to screen readers, e.g. "Mountain. You are 40% of the way up." */
  accessibilityLabel?: string;
}

/** The mountain, its route, camps, summit flag and the climbing avatar. */
export function MountainView({ avatarProgress, campMarkers = [], accessibilityLabel }: Props) {
  const palette = usePalette();
  const [avatarX, avatarY] = pointAlong(ROUTE_POINTS, avatarProgress);
  const [summitX, summitY] = pointAlong(ROUTE_POINTS, 1);

  return (
    // The accessibility props sit on a View: react-native-svg does not accept them on web.
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg viewBox="0 0 320 220" width="100%" style={{ aspectRatio: 320 / 220 }}>
        <Path d="M0 0H320V220H0Z" fill={palette.sky} />
        {/* Far ridge */}
        <Polygon
          points="0,214 70,120 120,160 170,110 250,170 320,130 320,214"
          fill={palette.rock}
          opacity={0.35}
        />
        {/* Main peak with a shaded right face and snow cap */}
        <Polygon points="20,214 204,22 306,214" fill={palette.rock} />
        <Polygon points="204,22 306,214 214,214 226,120" fill={palette.rockShade} />
        <Polygon points="204,22 178,50 192,58 204,48 216,60 228,46" fill={palette.snow} />

        <Polyline
          points={ROUTE_POINTS.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={palette.route}
          strokeWidth={2.5}
          strokeDasharray="5 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {campMarkers.map((progress) => {
          const [x, y] = pointAlong(ROUTE_POINTS, progress);
          return (
            <Polygon
              key={progress}
              points={`${x - 7},${y + 5} ${x},${y - 7} ${x + 7},${y + 5}`}
              fill={palette.route}
              stroke={palette.rockShade}
              strokeWidth={1}
            />
          );
        })}

        {/* Summit flag */}
        <Line
          x1={summitX}
          y1={summitY}
          x2={summitX}
          y2={summitY - 18}
          stroke={palette.text}
          strokeWidth={1.5}
        />
        <Polygon
          points={`${summitX},${summitY - 18} ${summitX + 12},${summitY - 14} ${summitX},${summitY - 10}`}
          fill={palette.danger}
        />

        {/* Avatar */}
        <Circle cx={avatarX} cy={avatarY} r={10} fill={palette.accent} opacity={0.25} />
        <Circle
          cx={avatarX}
          cy={avatarY}
          r={6}
          fill={palette.accent}
          stroke={palette.snow}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}
