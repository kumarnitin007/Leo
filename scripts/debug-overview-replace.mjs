import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const path = join(dirname(fileURLToPath(import.meta.url)), "../src/components/BankDashboard.tsx");
const s = fs.readFileSync(path, "utf8");
const start = s.indexOf('        {tab==="overview" && (');
const end = s.indexOf("        {/* ══ TIMELINE TAB");
console.log({ start, end, ok: start !== -1 && end !== -1 && end > start, hasComponent: s.includes("<BankOverviewTab") });
