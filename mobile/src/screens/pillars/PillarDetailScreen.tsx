import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError } from "../../api/client";
import { Pillar } from "../../api/types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { PillarsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PillarsStackParamList, "PillarDetail">;

export default function PillarDetailScreen({ route, navigation }: Props) {
  const theme = useAppTheme();
  const { pillarId } = route.params;
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Pillar>(`/api/pillars/${pillarId}`);
      setPillar(res);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load pillar.");
    } finally {
      setLoading(false);
    }
  }, [pillarId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = () => {
    Alert.alert("Delete pillar", "Tasks and goals linked to this pillar will keep their data but lose the pillar link. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/api/pillars/${pillarId}`);
            navigation.goBack();
          } catch (err) {
            setError(err instanceof ApiRequestError ? err.message : "Couldn't delete pillar.");
          }
        },
      },
    ]);
  };

  if (loading || !pillar) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]} edges={["top"]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.emoji}>{pillar.emoji || "📌"}</Text>
          <Text style={[styles.name, { color: theme.text }]}>{pillar.name}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: pillar.color || theme.accent }]}>
          <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Default points per task</Text>
          <Text style={{ color: theme.text }}>{pillar.defaultBasePoints}</Text>
        </View>

        {pillar.description && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: pillar.color || theme.accent }]}>
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Description</Text>
            <Text style={{ color: theme.text }}>{pillar.description}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { borderColor: theme.border }]} onPress={() => navigation.navigate("PillarForm", { pillarId })}>
            <Text style={[styles.actionText, { color: theme.text }]}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { borderColor: theme.danger }]} onPress={handleDelete}>
            <Text style={[styles.actionText, { color: theme.danger }]}>Delete</Text>
          </Pressable>
        </View>

        {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 28 },
  name: { fontSize: 24, fontWeight: "700" },
  card: { marginTop: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, padding: 14 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 13, fontWeight: "600" },
  error: { marginTop: 12, fontSize: 13 },
});
