import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

export type PickerOption = { value: string; label: string; emoji?: string };
export type PickerGroup = { label: string; options: PickerOption[] };

type Props = {
  value: string | string[];
  onChange: (next: any) => void;
  multi?: boolean;
  max?: number;
  options?: PickerOption[];
  groups?: PickerGroup[];
  placeholder?: string;
  modalTitle?: string;
  emptyHint?: string;
};

export default function PickerField({
  value,
  onChange,
  multi = false,
  max,
  options,
  groups,
  placeholder = "Choisir…",
  modalTitle = "Choisir",
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(false);

  const allOptions: PickerOption[] = useMemo(() => {
    if (groups) return groups.flatMap((g) => g.options);
    return options ?? [];
  }, [groups, options]);

  const selected: string[] = Array.isArray(value) ? value : value ? [value] : [];
  const lookup = useMemo(() => {
    const m = new Map<string, PickerOption>();
    allOptions.forEach((o) => m.set(o.value, o));
    return m;
  }, [allOptions]);

  const count = selected.length;
  const limitReached = multi && typeof max === "number" && count >= max;

  const toggle = (val: string) => {
    if (multi) {
      if (selected.includes(val)) {
        onChange(selected.filter((v) => v !== val));
      } else if (!limitReached) {
        onChange([...selected, val]);
      }
    } else {
      onChange(value === val ? "" : val);
      setOpen(false);
    }
  };

  const renderOption = (o: PickerOption) => {
    const active = selected.includes(o.value);
    const disabled = !active && limitReached;
    return (
      <Pressable
        key={o.value}
        style={[styles.option, active && styles.optionActive, disabled && styles.optionDisabled]}
        onPress={() => toggle(o.value)}
        disabled={disabled}
      >
        <Text style={[styles.optionText, active && styles.optionTextActive]}>
          {o.emoji ? `${o.emoji}  ` : ""}{o.label}
        </Text>
        {active ? <Ionicons name="checkmark" size={18} color={Pastel.primary} /> : null}
      </Pressable>
    );
  };

  return (
    <>
      {/* Champ repliable */}
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <View style={styles.fieldContent}>
          {selected.length === 0 ? (
            <Text style={styles.placeholder}>{placeholder}</Text>
          ) : (
            <View style={styles.chipsRow}>
              {selected.map((v) => {
                const o = lookup.get(v);
                return (
                  <View key={v} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {o?.emoji ? `${o.emoji} ` : ""}{o?.label ?? v}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color={Pastel.textMuted} />
      </Pressable>

      {/* Liste déroulante (modal) */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{modalTitle}</Text>
              {multi && typeof max === "number" ? (
                <Text style={styles.sheetCount}>{count}/{max}</Text>
              ) : null}
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={Pastel.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {groups
                ? groups.map((g) => (
                    <View key={g.label} style={styles.group}>
                      <Text style={styles.groupLabel}>{g.label}</Text>
                      {g.options.map(renderOption)}
                    </View>
                  ))
                : (options ?? []).map(renderOption)}
              {emptyHint && selected.length === 0 ? (
                <Text style={styles.emptyHint}>{emptyHint}</Text>
              ) : null}
            </ScrollView>

            {multi ? (
              <Pressable style={styles.validateBtn} onPress={() => setOpen(false)}>
                <Text style={styles.validateBtnText}>Valider</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  fieldContent: { flex: 1 },
  placeholder: { fontSize: 14, color: Pastel.textMuted, fontFamily: Font.medium, includeFontPadding: false },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: Pastel.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.primary, includeFontPadding: false },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "80%",
    backgroundColor: Pastel.surface,
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sheetTitle: { flex: 1, fontSize: 18, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  sheetCount: { fontSize: 13, fontFamily: Font.bold, color: Pastel.primary, includeFontPadding: false },
  sheetClose: { padding: 2 },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingBottom: 6 },
  group: { marginBottom: 12 },
  groupLabel: {
    fontSize: 12,
    fontFamily: Font.extraBold,
    color: Pastel.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Pastel.surfaceAlt,
  },
  optionActive: { backgroundColor: Pastel.primarySoft },
  optionDisabled: { opacity: 0.4 },
  optionText: { fontSize: 14, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  optionTextActive: { color: Pastel.primary, fontFamily: Font.bold },
  emptyHint: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false, paddingVertical: 6 },
  validateBtn: {
    marginTop: 12,
    backgroundColor: Pastel.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  validateBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
});
