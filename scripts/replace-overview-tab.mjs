import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const path = join(root, "../src/components/BankDashboard.tsx");
let s = fs.readFileSync(path, "utf8");

const start = s.indexOf('        {tab==="overview" && (');
const endMarker = "        {/* ══ TIMELINE TAB";
const end = s.indexOf(endMarker);
if (start === -1 || end === -1) {
  console.error("markers not found", { start, end });
  process.exit(1);
}

const replacement = `        {tab==="overview" && (
          <BankOverviewTab
            theme={THEME}
            isMobile={isMobile}
            deposits={deposits}
            accounts={accounts}
            bills={bills}
            actions={actions}
            goals={goals}
            displayCurrency={displayCurrency}
            setDisplayCurrency={setDisplayCurrency}
            exchangeRates={exchangeRates}
            targetCurrency={targetCurrency}
            netWorthConverted={netWorthConverted}
            sumConverted={sumConverted}
            totalInvested={totalInvested}
            totalMaturity={totalMaturity}
            maturingSoonDeposits={maturingSoonDeposits}
            actionsDue30={actionsDue30}
            depositsPrincipalConverted={depositsTablePrincipalConverted}
            overviewActionsCount={overviewActionsCount}
            portfolioHistoryChartData={portfolioHistoryChartData}
            portfolioHistoryXDomain={portfolioHistoryXDomain}
            portfolioHistoryYDomain={portfolioHistoryYDomain}
            portfolioHistorySnapshotCount={portfolioHistorySnapshotCount}
            showPortfolioHistory={showPortfolioHistory}
            setShowPortfolioHistory={setShowPortfolioHistory}
            clearPortfolioHistory={clearPortfolioHistory}
            deletePortfolioHistoryEntry={deletePortfolioHistoryEntry}
            setShowRatesModal={setShowRatesModal}
            show30Days={show30Days}
            setShow30Days={setShow30Days}
            expandedBanks={expandedBanks}
            setExpandedBanks={setExpandedBanks}
            setTab={setTab}
            persist={persist}
            totalValueHistory={totalValueHistory}
            toggleDone={toggleDone}
            getBankColor={getBankColor}
          />
        )}

`;

s = s.slice(0, start) + replacement + s.slice(end);

if (!s.includes("BankOverviewTab")) {
  console.error("replace failed");
  process.exit(1);
}

fs.writeFileSync(path, s, "utf8");
console.log("Replaced overview block");
