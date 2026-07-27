import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError } from "../../api/client";
import { Pillar } from "../../api/types";
import { FormInput } from "../../components/FormField";
import FormSection from "../../components/FormSection";
import { useAppTheme } from "../../hooks/useAppTheme";
import { PillarsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PillarsStackParamList, "PillarForm">;

const COLOR_PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
];

export default function PillarFormScreen({ route, navigation }: Props) {
  const theme = useAppTheme();
  const editingId = route.params?.pillarId;
  const isEditing = editingId != null;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📌");
  const [color, setColor] = useState("#3B82F6");
  const [defaultBasePoints, setDefaultBasePoints] = useState("10");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const pillar = await api.get<Pillar>(`/api/pillars/${editingId}`);
        setName(pillar.name);
        setEmoji(pillar.emoji || "📌");
        setColor(pillar.color || "#3B82F6");
        setDefaultBasePoints(String(pillar.defaultBasePoints ?? 10));
        setDescription(pillar.description ?? "");
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load pillar.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, editingId]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      emoji: emoji.trim() || "📌",
      color,
      defaultBasePoints: Number(defaultBasePoints) || 10,
      description: description.trim() || null,
    };
    try {
      if (isEditing) {
        await api.put(`/api/pillars/${editingId}`, body);
      } else {
        await api.post("/api/pillars", body);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save pillar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]} edges={["top"]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>{isEditing ? "Edit Pillar" : "New Pillar"}</Text>

          <FormSection theme={theme} title="Details">
            <FormInput theme={theme} label="Name" value={name} onChangeText={setName} placeholder="Pillar name" />
            <FormInput theme={theme} label="Emoji" value={emoji} onChangeText={setEmoji} placeholder="📌" maxLength={4} />
            <FormInput
              theme={theme}
              label="Default points per task"
              value={defaultBasePoints}
              onChangeText={setDefaultBasePoints}
              keyboardType="number-pad"
              placeholder="10"
            />
            <FormInput
              theme={theme}
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What does this pillar cover?"
              multiline
              style={styles.multiline}
            />
          </FormSection>

          <FormSection theme={theme} title="Color">
            <View style={styles.swatchRow}>
              {COLOR_PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && [styles.swatchSelected, { borderColor: theme.text }],
                  ]}
                />
              ))}
            </View>
          </FormSection>

          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

          <Pressable style={[styles.saveButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isEditing ? "Save changes" : "Create pillar"}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 8 },
  swatchSelected: { borderWidth: 3 },
  error: { marginTop: 16, fontSize: 13 },
  saveButton: { marginTop: 28, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
