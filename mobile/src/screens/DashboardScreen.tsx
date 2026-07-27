import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError } from "../api/client";
import { DailyScore, Momentum, ScoreHistoryResponse } from "../api/types";
import FlameGauge from "../components/FlameGauge";
import { fonts } from "../fonts";
import { useAppTheme } from "../hooks/useAppTheme";
import { todayString } from "../utils/date";

function RivetCorners({ color }: { color: string }) {
  return (
    <>
      <View style={[styles.rivet, styles.rivetTL, { backgroundColor: color }]} />
      <View style={[styles.rivet, styles.rivetTR, { backgroundColor: color }]} />
      <View style={[styles.rivet, styles.rivetBL, { backgroundColor: color }]} />
      <View style={[styles.rivet, styles.rivetBR, { backgroundColor: color }]} />
    </>
  );
}

export default function DashboardScreen() {
  const theme = useAppTheme();
  const [score, setScore] = useState<DailyScore | null>(null);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  const [history, setHistory] = useState<ScoreHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [scoreRes, momentumRes, historyRes] = await Promise.all([
        api.get<DailyScore>(`/api/daily-score?date=${todayString()}`),
        api.get<Momentum>("/api/momentum"),
        api.get<ScoreHistoryResponse>("/api/daily-score/history?days=7"),
      ]);
      setScore(scoreRes);
      setMomentum(momentumRes);
      setHistory(historyRes);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]} edges={["top"]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  const maxScore = Math.max(1, ...(history?.scores.map((s) => s.actionScore) ?? [1]));

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
      >
        <Text style={[styles.title, { color: theme.text, fontFamily: fonts.display }]}>Dashboard</Text>
        {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

        {score && (
          <View style={[styles.card, styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <RivetCorners color={theme.border} />
            <FlameGauge theme={theme} pct={score.actionScore} />
          </View>
        )}

        {score && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.subtext, fontFamily: fonts.bodySemiBold }]}>Today</Text>
            <View style={styles.scoreRow}>
              <View>
                <Text style={[styles.scoreValue, { color: theme.accent, fontFamily: fonts.monoBold }]}>{score.actionScore}</Text>
                <Text style={[styles.scoreLabel, { color: theme.subtext, fontFamily: fonts.bodyMedium }]}>{score.scoreTier}</Text>
              </View>
              <View style={styles.scoreStats}>
                <Text style={{ color: theme.subtext, fontSize: 13, fontFamily: fonts.body }}>
                  <Text style={{ fontFamily: fonts.mono }}>{score.completedTasks}/{score.totalTasks}</Text> tasks done
                </Text>
                {score.momentumScore != null && (
                  <Text style={{ color: theme.subtext, fontSize: 13, fontFamily: fonts.body }}>
                    Momentum <Text style={{ fontFamily: fonts.mono }}>{score.momentumScore.toFixed(2)}×</Text>
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {score && score.pillarScores.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.subtext, fontFamily: fonts.bodySemiBold }]}>Pillar breakdown</Text>
            {score.pillarScores.map((p) => (
              <View key={p.id} style={styles.pillarRow}>
                <Text style={{ color: theme.text, fontSize: 14, fontFamily: fonts.body }}>{p.emoji ? `${p.emoji} ` : ""}{p.name}</Text>
                <Text style={{ color: theme.accent, fontSize: 14, fontFamily: fonts.monoSemiBold }}>{p.score}</Text>
              </View>
            ))}
          </View>
        )}

        {momentum && (momentum.overall != null || momentum.trajectory.overall != null) && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.subtext, fontFamily: fonts.bodySemiBold }]}>Goals</Text>
            {momentum.overall != null && (
              <View style={styles.pillarRow}>
                <Text style={{ color: theme.text, fontSize: 14, fontFamily: fonts.body }}>Momentum (target goals)</Text>
                <Text style={{ color: theme.accent, fontSize: 14, fontFamily: fonts.monoSemiBold }}>{momentum.overall.toFixed(2)}×</Text>
              </View>
            )}
            {momentum.trajectory.overall != null && (
              <View style={styles.pillarRow}>
                <Text style={{ color: theme.text, fontSize: 14, fontFamily: fonts.body }}>Trajectory (outcome goals)</Text>
                <Text style={{ color: theme.accent, fontSize: 14, fontFamily: fonts.monoSemiBold }}>{momentum.trajectory.overall.toFixed(2)}×</Text>
              </View>
            )}
          </View>
        )}

        {history && history.scores.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.subtext, fontFamily: fonts.bodySemiBold }]}>Last 7 days</Text>
            <View style={styles.trendRow}>
              {[...history.scores].reverse().slice(-7).map((s) => (
                <View key={s.date} style={styles.trendBarWrap}>
                  <View style={[styles.trendBar, { height: Math.max(4, (s.actionScore / maxScore) * 60), backgroundColor: theme.accent }]} />
                  <Text style={[styles.trendLabel, { color: theme.subtext, fontFamily: fonts.mono }]}>{s.date.slice(5)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const RIVET_SIZE = 5;
const RIVET_INSET = 10;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 26, marginBottom: 12 },
  error: { marginBottom: 12, fontSize: 13 },
  card: { borderRadius: 6, borderWidth: 1, padding: 14, marginBottom: 16 },
  heroCard: { paddingVertical: 20, alignItems: "center", position: "relative" },
  rivet: { position: "absolute", width: RIVET_SIZE, height: RIVET_SIZE, borderRadius: RIVET_SIZE / 2 },
  rivetTL: { top: RIVET_INSET, left: RIVET_INSET },
  rivetTR: { top: RIVET_INSET, right: RIVET_INSET },
  rivetBL: { bottom: RIVET_INSET, left: RIVET_INSET },
  rivetBR: { bottom: RIVET_INSET, right: RIVET_INSET },
  sectionTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreValue: { fontSize: 34 },
  scoreLabel: { fontSize: 12, textTransform: "capitalize" },
  scoreStats: { alignItems: "flex-end", gap: 4 },
  pillarRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  trendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 90 },
  trendBarWrap: { alignItems: "center", flex: 1 },
  trendBar: { width: 18, borderRadius: 3 },
  trendLabel: { fontSize: 10, marginTop: 6 },
});
