import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rawPath = path.join(root, "src/components/bank/_dep_raw.tsx");
const outPath = path.join(root, "src/components/bank/BankDepositsTab.tsx");

let lines = fs.readFileSync(rawPath, "utf8").split(/\n/);
lines.shift(); // comment
lines.shift(); // {tab === "deposits" && (() => {
while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
if (lines[lines.length - 1].trim() === "})()}") lines.pop();

const DEDENT = 8;
const body = lines
  .map((l) => (l.length >= DEDENT && l.slice(0, DEDENT) === " ".repeat(DEDENT) ? l.slice(DEDENT) : l))
  .join("\n");

const file = `import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Deposit, Currency } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import { daysUntil, fmt, fmtDate, getBankColor } from "../../bank/bankDashboardFormat";
import { UrgencyBadge, inputSt } from "./BankDashboardPrimitives";

export type DepositsPieSlice = { name: string; value: number; color: string };

export interface BankDepositsTabProps {
  theme: BankDashboardTheme;
  deposits: Deposit[];
  filtered: Deposit[];
  banks: string[];
  isMobile: boolean;
  search: string;
  setSearch: (v: string) => void;
  filterBank: string;
  setFilterBank: (v: string) => void;
  depositsViewMode: "cards" | "grouped" | "flat";
  setDepositsViewMode: (m: "cards" | "grouped" | "flat") => void;
  expandedBanks: Set<string>;
  setExpandedBanks: React.Dispatch<React.SetStateAction<Set<string>>>;
  showLegend: Set<string>;
  setShowLegend: React.Dispatch<React.SetStateAction<Set<string>>>;
  typePieData: DepositsPieSlice[];
  openAdd: (t: string) => void;
  openEdit: (t: string, i: number) => void;
  deleteRow: (t: string, i: number) => void;
  toggleDone: (t: string, i: number) => void;
}

export function BankDepositsTab({
  theme: THEME,
  deposits,
  filtered,
  banks,
  isMobile,
  search,
  setSearch,
  filterBank,
  setFilterBank,
  depositsViewMode,
  setDepositsViewMode,
  expandedBanks,
  setExpandedBanks,
  showLegend,
  setShowLegend,
  typePieData,
  openAdd,
  openEdit,
  deleteRow,
  toggleDone,
}: BankDepositsTabProps) {
${body}
}
`;

fs.writeFileSync(outPath, file, "utf8");
console.log("Wrote", outPath);
