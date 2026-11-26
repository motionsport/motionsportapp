import type { TrainingType } from "./api";

// Applied as inline styles
export const TYPE_COLORS: Record<TrainingType, { bg: string; border: string; text: string }> = {
  group: { bg: "#14532d", border: "#93d23c", text: "#bbf7d0" },
  personal: { bg: "#3b2f00", border: "#eab308", text: "#fef08a" },
  split: { bg: "#7c2d12", border: "#fb923c", text: "#fed7aa" },
};

// A cancelled group training in the calendar, greyed whatever its type: the brand's surface / line / subtle tokens
export const CANCELLED_COLORS = { bg: "#0d1019", border: "#1a2040", text: "#8a9bc0" };

// Singular, for one training
export const TYPE_LABEL: Record<TrainingType, string> = {
  group: "Групове",
  personal: "Персональне",
  split: "Спліт",
};

// Plural, for the kind of training
export const TYPE_LABEL_PLURAL: Record<TrainingType, string> = {
  group: "Групові",
  personal: "Персональні",
  split: "Спліт",
};
