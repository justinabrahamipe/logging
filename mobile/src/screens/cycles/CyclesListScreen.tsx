import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError, isOfflineError } from "../../api/client";
import { Cycle } from "../../api/types";
import FAB from "../../components/FAB";
import { useAppTheme } from "../../hooks/useAppTheme";
import { CyclesStackParamList } from "../../navigation/types";
import { getJSON, setJSON } from "../../offline/storage";
import { todayString } from "../../utils/date";

const CACHE_KEY = "grindconsole.offline.cyclesCache";

type Props = { navigation: NativeStackNavigationProp<CyclesStackParamList, "CyclesList"> };

export default function CyclesListScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    setError(null);

    let hasCached = false;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      const cached = await getJSON<Cycle[]>(CACHE_KEY);
      if (cached) {
        setCycles(cached);
        hasCached = true;
      }
      setLoading(!cached);
    }

    try {
      const res = await api.get<Cycle[]>("/api/cycles");
      setCycles(res);
      await setJSON(CACHE_KEY, res);
    } catch (err) {
      if (!(hasCached && isOfflineError(err))) {
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load cycles.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = todayString();
  const sections = [
    { title: "Active", data: cycles.filter((c) => c.isActive) },
    { title: "Future", data: cycles.filter((c) => !c.isActive && c.startDate > today) },
    { title: "Past", data: cycles.filter((c) => !c.isActive && c.endDate < today) },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Cycles</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : (
        <SectionList
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.subtext }]}>No cycles yet.</Text>}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: theme.subtext, backgroundColor: theme.bg }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate("CycleDetail", { cycleId: item.id })}
            >
              <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
              {item.theme && <Text style={[styles.cardMeta, { color: theme.accent }]}>{item.theme}</Text>}
              <Text style={[styles.cardMeta, { color: theme.subtext }]}>{item.startDate} → {item.endDate}</Text>
            </Pressable>
          )}
        />
      )}
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <FAB theme={theme} onPress={() => navigation.navigate("CycleForm", {})} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  loading: { marginTop: 40 },
  listContent: { padding: 16, paddingBottom: 100 },
  sectionHeader: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, paddingVertical: 8 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 12 },
  cardName: { fontSize: 16, fontWeight: "600" },
  cardMeta: { fontSize: 12, marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
  error: { textAlign: "center", marginBottom: 12, fontSize: 13 },
});
