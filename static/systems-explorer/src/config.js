export const NS = "http://www.w3.org/2000/svg";
export const PACKAGE_CAP = 1500;
export const MIN_DELAY = 0.04;
export const MIN_PACKAGE_TRAVEL = 0.85;

export const NODE_COLORS = [
  "#BD0129", "#FF9200", "#69A257", "#35512C",
  "#A02B93", "#6151A1", "#FEB6C6", "#1D1D1D"
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
