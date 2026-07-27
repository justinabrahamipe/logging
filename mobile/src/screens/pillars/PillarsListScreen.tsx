import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError } from "../../api/client";
import { Pillar } from "../../api/types";
import FAB from "../../components/FAB";
import { useAppTheme } from "../../hooks/useAppTheme";
import { PillarsStackParamList } from "../../navigation/types";

type Props = { navigation: NativeStackNavigationProp<PillarsStackParamList, "PillarsList"> };

export default function PillarsListScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get<Pillar[]>("/api/pillars");
      setPillars(res);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load pillars.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Pillars</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={pillars}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.subtext }]}>No pillars yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: item.color || theme.accent }]}
              onPress={() => navigation.navigate("PillarDetail", { pillarId: item.id })}
            >
              <Text style={styles.emoji}>{item.emoji || "📌"}</Text>
              <View style={styles.info}>
                <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.cardMeta, { color: theme.subtext }]}>{item.defaultBasePoints} pts/task</Text>
              </View>
            </Pressable>
          )}
        />
      )}
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <FAB theme={theme} onPress={() => navigation.navigate("PillarForm", {})} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  loading: { marginTop: 40 },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, padding: 14, marginBottom: 12, gap: 12 },
  emoji: { fontSize: 22 },
  info: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "600" },
  cardMeta: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
  error: { textAlign: "center", marginBottom: 12, fontSize: 13 },
});
