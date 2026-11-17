import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

// Placeholder home screen. Replaced by onboarding + mountain view in Phase 2.
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>DailyAscend</Text>
        <Text style={styles.subtitle}>One mountain. One climb a day.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.textMuted },
});
