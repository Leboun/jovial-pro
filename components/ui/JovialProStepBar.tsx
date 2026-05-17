import { StyleSheet, Text, View } from "react-native";

import { Pastel } from "@/constants/pastel";

const STEPS = ["Offre", "Details", "Compte", "Paiement"];

type Props = {
  step: 1 | 2 | 3 | 4;
  caption?: string;
};

export default function JovialProStepBar({ step, caption }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {STEPS.map((label, index) => {
          const rank = index + 1;
          const active = rank === step;
          const completed = rank < step;

          return (
            <View
              key={label}
              style={[
                styles.step,
                active ? styles.stepActive : null,
                completed ? styles.stepCompleted : null,
              ]}
            >
              <Text
                style={[
                  styles.stepIndex,
                  active ? styles.stepIndexActive : null,
                  completed ? styles.stepIndexCompleted : null,
                ]}
              >
                {rank}
              </Text>
              <Text
                style={[
                  styles.stepLabel,
                  active ? styles.stepLabelActive : null,
                  completed ? styles.stepLabelCompleted : null,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stepActive: {
    borderColor: Pastel.primary,
    backgroundColor: "#F7F9FF",
  },
  stepCompleted: {
    borderColor: "#CFE8D7",
    backgroundColor: "#F2FBF5",
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
    color: Pastel.textMuted,
    backgroundColor: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 22,
  },
  stepIndexActive: {
    color: "#FFFFFF",
    backgroundColor: Pastel.primary,
  },
  stepIndexCompleted: {
    color: "#FFFFFF",
    backgroundColor: "#1E7A36",
  },
  stepLabel: {
    color: Pastel.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  stepLabelActive: {
    color: Pastel.text,
  },
  stepLabelCompleted: {
    color: "#1E7A36",
  },
  caption: {
    color: Pastel.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
