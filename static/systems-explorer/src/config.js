export const STORE_KEY = "hdi-systems-explorer-v5";
export const NS = "http://www.w3.org/2000/svg";
export const PACKAGE_CAP = 1500;
export const MIN_DELAY = 0.04;
export const MIN_PACKAGE_TRAVEL = 0.85;

export const NODE_COLORS = [
  "#BD0129", "#8E011F", "#E11D48", "#F97316",
  "#F59E0B", "#84CC16", "#16A34A", "#14B8A6",
  "#06B6D4", "#2563EB", "#4F46E5", "#7C3AED",
  "#C026D3", "#DB2777", "#64748B", "#111827"
];

export const TRIGGER_OPTIONS = [
  { value: "any", label: "Any change", short: "chg" },
  { value: "increase", label: "Increase only", short: "up" },
  { value: "decrease", label: "Decrease only", short: "down" }
];

export const GATE_OPTIONS = [
  { value: "always", label: "Always", short: "always" },
  { value: "above", label: "Source >", short: ">" },
  { value: "below", label: "Source <", short: "<" }
];

export const PAYLOAD_OPTIONS = [
  { value: "fixed", label: "Fixed amount", suffix: "abs" },
  { value: "prop", label: "% of source", suffix: "%" },
  { value: "delta", label: "% of source delta", suffix: "% delta" }
];
