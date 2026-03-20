import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../src/components/BankDashboard.tsx");
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf('{tab === "deposits" && (() => {');
if (start < 0) {
  console.error("start not found");
  process.exit(1);
}
const accountsIdx = s.indexOf("{/* ══ ACCOUNTS TAB", start);
if (accountsIdx < 0) {
  console.error("accounts marker not found");
  process.exit(1);
}
const slice = s.slice(start, accountsIdx);
const needle = "})()}";
const lastClose = slice.lastIndexOf(needle);
if (lastClose < 0) {
  console.error("close not found");
  process.exit(1);
}
const end = start + lastClose + needle.length;

const newBlock = `        {tab === "deposits" && (
          <BankDepositsTab
            theme={THEME}
            deposits={deposits}
            filtered={filtered}
            banks={banks}
            isMobile={isMobile}
            search={search}
            setSearch={setSearch}
            filterBank={filterBank}
            setFilterBank={setFilterBank}
            depositsViewMode={depositsViewMode}
            setDepositsViewMode={setDepositsViewMode}
            expandedBanks={expandedBanks}
            setExpandedBanks={setExpandedBanks}
            showLegend={showLegend}
            setShowLegend={setShowLegend}
            typePieData={typePieData}
            openAdd={openAdd}
            openEdit={openEdit}
            deleteRow={deleteRow}
            toggleDone={toggleDone}
          />
        )}`;

const out = s.slice(0, start) + newBlock + s.slice(end);
fs.writeFileSync(p, out, "utf8");
console.log("OK: replaced", end - start, "bytes");
