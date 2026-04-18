/**
 * Bank / Deposits / Bills Excel import parsing and template export.
 * Keeps column-mapping logic out of BankDashboard.tsx.
 */
import { read, utils, writeFile, type WorkBook } from "xlsx";
import type { ActionItem, BankAccount, Bill, Currency, Deposit, DepositCategory } from "../types/bankRecords";
import { extractDateFromTitle } from "../bank/actionDateParse";

const IMPORT_CURRENCIES = new Set<Currency>(["INR", "USD", "EUR", "GBP"]);

function normalizeImportCurrency(val: unknown): Currency {
  const u =
    val == null || String(val).trim() === ""
      ? "INR"
      : String(val).trim().toUpperCase();
  return IMPORT_CURRENCIES.has(u as Currency) ? (u as Currency) : "INR";
}

const MS_PER_DAY = 86400000;
const EXCEL_EPOCH_OFFSET = 25569;

export type DeleteDepositKey = { bank: string; depositId?: string; startDate?: string };
/** accountNumber distinguishes multiple rows same bank+type+holders (e.g. two SCSS at ICICI). */
export type DeleteAccountKey = { bank: string; type: string; holders: string; accountNumber?: string };
export type DeleteBillKey = { name: string };

function normAccountField(v: string | undefined | null): string {
  return v == null ? "" : String(v).trim();
}

/** Excel merge / delete identity: bank + type + holders + account number (trimmed). */
export function bankAccountMergeKey(a: Pick<BankAccount, "bank" | "type" | "holders" | "accountNumber">): string {
  return `${normAccountField(a.bank)}|${normAccountField(a.type)}|${normAccountField(a.holders)}|${normAccountField(a.accountNumber)}`;
}

export function bankAccountMatchesDeleteKey(a: BankAccount, del: DeleteAccountKey): boolean {
  return bankAccountMergeKey(a) === bankAccountMergeKey({
    bank: del.bank,
    type: del.type,
    holders: del.holders,
    accountNumber: del.accountNumber ?? "",
  });
}

export type DeleteActionKey = { title: string; bank: string };

// TODO(ACTION/INFO inline rows): Excel screenshot (2026-04-17) shows two new
// inline blocks in the Deposits/Accounts sheet:
//   1. ACTION rows — rows with Status="ACTION", Due Date, and free-text Action
//      (e.g. "MIS - Check Phone number", "Whose number is 9051089439?").
//      Suggested mapping: extend this parser to recognize the ACTION block
//      (header "Status | Due Date | Action") and push each row into
//      `newActions` with title=Action text, date=Due Date, priority optional.
//      Extra columns worth capturing (for future): category, linkedAccount,
//      notes, recurrence (e.g. quarterly ROI check).
//      Best in-app home: existing Financial "Actions" tab (already supports
//      ActionItem). A My Lists system-controlled list would be secondary.
//   2. INFO rows — {Source | ID | VALUE} key/value pairs attached to a specific
//      source (e.g. "Post Office | IFSC Post | IPOS0000DOP").
//      Suggested mapping: store as `accountInfo` map on BankAccount
//      (`accountInfo?: Array<{ id: string; value: string }>`) so each account
//      can carry free-form IFSC/SWIFT/Phone/Ref-Flow notes.
//      Surface inside the Account card's "Extra info" area or a new expandable
//      "Info" row in the Excel view. Deferred — discuss exact schema first.

export interface BankRecordsExcelParseResult {
  newDeposits: Deposit[];
  newAccounts: BankAccount[];
  newBills: Bill[];
  newActions: ActionItem[];
  deleteDeposits: DeleteDepositKey[];
  deleteAccounts: DeleteAccountKey[];
  deleteBills: DeleteBillKey[];
  deleteActions: DeleteActionKey[];
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function cellToYMD(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split("T")[0];
  if (typeof val === "number" && Number.isFinite(val)) {
    const ms = EXCEL_EPOCH_MS + Math.round(val * 86400000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    const t = val.trim();
    if (/^\d+\.?\d*$/.test(t)) {
      const n = parseFloat(t);
      if (n > 2000 && n < 80000) {
        const ms = EXCEL_EPOCH_MS + Math.round(n * 86400000);
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      }
    }
    const parsed = new Date(t);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  }
  return null;
}

function cellToISOStartOfDay(val: unknown): string | undefined {
  const ymd = cellToYMD(val);
  return ymd ? `${ymd}T12:00:00.000Z` : undefined;
}

function headerNorm(x: unknown) {
  return x == null ? "" : String(x).toLowerCase().replace(/\s+/g, " ").trim();
}

function buildBankNotes(r: unknown[], cLim: number, cExtra: number, cI1: number, cI2: number, cDe: number) {
  const lines: string[] = [];
  const push = (label: string, idx: number) => {
    if (idx < 0) return;
    const v = r[idx];
    if (v == null || String(v).trim() === "") return;
    lines.push(`${label}: ${String(v).trim()}`);
  };
  push("Limits", cLim);
  push("Extra Info", cExtra);
  push("Info 1", cI1);
  push("Info 2", cI2);
  push("Details", cDe);
  return lines.join("\n");
}

/** Read a user-selected .xlsx/.xls into a workbook (same options as dashboard import). */
export async function readBankRecordsFile(file: File): Promise<WorkBook> {
  const buf = await file.arrayBuffer();
  return read(buf, { type: "array", cellDates: true });
}

/**
 * Parse Deposits, Banks, Bills sheets from an already-loaded workbook (from `read()`).
 */
export function parseBankRecordsWorkbook(
  wb: WorkBook,
  depositCategories: readonly DepositCategory[]
): BankRecordsExcelParseResult {
  const newDeposits: Deposit[] = [];
  const newAccounts: BankAccount[] = [];
  const newBills: Bill[] = [];
  const newActions: ActionItem[] = [];
  const deleteDeposits: DeleteDepositKey[] = [];
  const deleteAccounts: DeleteAccountKey[] = [];
  const deleteBills: DeleteBillKey[] = [];
  const deleteActions: DeleteActionKey[] = [];

  const catSet = new Set(depositCategories);

  // ── Deposits ──
  if (wb.SheetNames.includes("Deposits")) {
    const rows = utils.sheet_to_json(wb.Sheets["Deposits"], { header: 1, defval: null }) as unknown[][];
    const hIdx = rows.findIndex(
      (row) =>
        row &&
        row.some((x) => headerNorm(x) === "bank") &&
        row.some((x) => headerNorm(x).includes("deposit id"))
    );
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const colExact = (name: string) =>
        h.findIndex((x) => x != null && headerNorm(x) === name.toLowerCase());
      const colIncludes = (sub: string) =>
        h.findIndex((x) => x != null && headerNorm(x).includes(sub.toLowerCase()));
      const cB = colExact("bank");
      const cT = colExact("type");
      const cI = h.findIndex((x) => headerNorm(x).includes("deposit") && headerNorm(x).includes("id"));
      const cN = colExact("nominee");
      const cOwner = colExact("account owner");
      const cS = colExact("start date");
      const cUpd = h.findIndex((x) => {
        const s = headerNorm(x);
        return s === "update date" || (s.includes("update") && s.includes("date"));
      });
      let cR = colExact("roi");
      if (cR < 0) cR = colIncludes("roi");
      const cM = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("maturity") && s.includes("amount");
      });
      const cMD = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("maturity") && s.includes("date");
      });
      const cDu = colExact("duration");
      let cMatAct = colExact("maturity");
      if (cMatAct < 0) cMatAct = colExact("maturity action");
      if (cMatAct < 0) {
        cMatAct = h.findIndex((x) => {
          const s = headerNorm(x);
          return s.includes("maturity") && s.includes("action");
        });
      }
      const cD = h.findIndex((x) => {
        const s = headerNorm(x);
        return s === "deposit" || (s.includes("deposit") && !s.includes("id"));
      });
      const cStatus = colExact("status");
      const cCur = colExact("currency");
      const cCat = colExact("category");
      const cTds = h.findIndex((x) => {
        const s = headerNorm(x);
        return s === "tds percent" || (s.includes("tds") && s.includes("percent"));
      });
      const cAuto = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("auto") && s.includes("renewal");
      });
      const cLink = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("linked") && s.includes("account");
      });
      const cNextDue = h.findIndex((x) => {
        const s = headerNorm(x);
        return (
          (s.includes("next") && s.includes("action") && s.includes("due")) ||
          s === "next action due date" ||
          s === "action due date"
        );
      });
      const cNextAct = h.findIndex((x) => {
        const s = headerNorm(x);
        if (s.includes("due")) return false;
        return s.includes("next") && s.includes("action");
      });
      const cNotes = colExact("notes");

      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i] as unknown[];
        if (!r || cB < 0 || !r[cB]) continue;
        const bank = r[cB]?.toString().trim();
        if (!bank || bank === "Row Labels") continue;
        const bankLower = bank.toLowerCase();
        if (bankLower.includes("total") || bankLower.includes("grand") || bankLower.includes("sum") || bankLower === "total") continue;
        if (cStatus >= 0 && r[cStatus]) {
          const status = r[cStatus].toString().toLowerCase().trim();
          if (status === "delete" || status === "remove") {
            deleteDeposits.push({
              bank,
              depositId: cI >= 0 ? r[cI]?.toString() || "" : "",
              startDate: cellToYMD(cS >= 0 ? r[cS] : null) || "",
            });
            continue;
          }
          if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
        }
        const ownerStr =
          cOwner >= 0 && r[cOwner] != null && String(r[cOwner]).trim() !== "" ? String(r[cOwner]).trim() : "";
        const autoY =
          cAuto >= 0 && r[cAuto]
            ? ["yes", "true", "1", "y"].includes(String(r[cAuto]).toLowerCase().trim())
            : false;
        const rawCat = cCat >= 0 && r[cCat] ? String(r[cCat]).trim() : "";
        const categoryVal: DepositCategory =
          rawCat && catSet.has(rawCat as DepositCategory) ? (rawCat as DepositCategory) : "General Savings";
        const hasDepositCurrencyCell =
          cCur >= 0 && r[cCur] != null && String(r[cCur]).trim() !== "";
        const nextDueYmd = cNextDue >= 0 ? cellToYMD(r[cNextDue]) : null;
        newDeposits.push({
          bank,
          type: cT >= 0 && r[cT] ? r[cT].toString() : "Fixed Deposit",
          depositId: cI >= 0 && r[cI] ? r[cI].toString() : "",
          accountOwner: ownerStr,
          nominee: cN >= 0 && r[cN] ? r[cN].toString() : "",
          startDate: cellToYMD(cS >= 0 ? r[cS] : null) || "",
          deposit: cD >= 0 && r[cD] != null ? parseFloat(String(r[cD])) || 0 : 0,
          roi: cR >= 0 && r[cR] != null ? parseFloat(String(r[cR])) || 0 : 0,
          maturityAmt: cM >= 0 && r[cM] != null ? parseFloat(String(r[cM])) || 0 : 0,
          maturityDate: cellToYMD(cMD >= 0 ? r[cMD] : null) || "",
          duration: cDu >= 0 && r[cDu] ? r[cDu].toString() : "",
          maturityAction: cMatAct >= 0 && r[cMatAct] ? r[cMatAct].toString() : "",
          ...(hasDepositCurrencyCell
            ? { currency: normalizeImportCurrency(r[cCur]) }
            : {}),
          done: false,
          lastBalanceUpdatedAt: cellToISOStartOfDay(cUpd >= 0 ? r[cUpd] : null),
          category: categoryVal,
          tdsPercent: cTds >= 0 && r[cTds] != null ? parseFloat(String(r[cTds])) || "" : "",
          autoRenewal: autoY,
          linkedAccount: cLink >= 0 && r[cLink] ? r[cLink].toString() : "",
          ...(cNextAct >= 0 ? { nextAction: r[cNextAct] != null ? String(r[cNextAct]).trim() : "" } : {}),
          ...(nextDueYmd ? { nextActionDueDate: nextDueYmd } : {}),
          notes: cNotes >= 0 && r[cNotes] ? r[cNotes].toString() : "",
        });
      }
    }
  }

  // ── Banks ──
  if (wb.SheetNames.includes("Banks")) {
    const rows = utils.sheet_to_json(wb.Sheets["Banks"], { header: 1, defval: null }) as unknown[][];
    const hIdx = rows.findIndex((row) => row && row.some((x) => headerNorm(x) === "source"));
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const colIncludes = (sub: string) =>
        h.findIndex((x) => x != null && headerNorm(x).includes(sub.toLowerCase()));
      const colExact = (name: string) =>
        h.findIndex((x) => x != null && headerNorm(x) === name.toLowerCase());

      const cS = colExact("source");
      const cA = colExact("amount");
      const cT = colExact("type");
      const cOl = colIncludes("online");
      const cNextDueAcc = h.findIndex((x) => {
        const s = headerNorm(x);
        return (
          (s.includes("next") && s.includes("action") && s.includes("due")) ||
          s === "next action due date" ||
          s === "action due date"
        );
      });
      const cAc = h.findIndex((x) => {
        const s = headerNorm(x);
        if (s.includes("due")) return false;
        return s.includes("next") && s.includes("action");
      });
      const cR = colIncludes("roi");
      const cAd = colIncludes("address");
      const cDe = colExact("details");
      const cNom = colExact("nominee");
      const cChk = colIncludes("checked");
      const cOwner = colExact("account owner");
      const cN1 = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("1st") && (s.includes("name") || s.includes("holder"));
      });
      const cN2 = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("2nd") && (s.includes("name") || s.includes("holder"));
      });
      const cLim = colExact("limits");
      const cExtra = h.findIndex(
        (x) => headerNorm(x) === "extra info" || headerNorm(x).includes("extra info")
      );
      const cI1 = colExact("info 1");
      const cI2 = colExact("info 2");
      const cAccNum = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("account") && s.includes("number");
      });
      const cIfsc = colIncludes("ifsc");
      const cBranch = colExact("branch");
      const cUpdOn = h.findIndex((x) => {
        const s = headerNorm(x);
        return s.includes("updated") && s.includes("on");
      });
      const cStatus = colExact("status");
      const cCur = colExact("currency");
      const cHidden = colExact("hidden");

      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i] as unknown[];
        if (!r || cS < 0 || !r[cS]) continue;
        const bank = r[cS]?.toString().trim();
        if (!bank) continue;
        const bankLower = bank.toLowerCase();
        if (bankLower.includes("total") || bankLower.includes("grand") || bankLower.includes("sum")) continue;

        let holdersForDelete = "";
        if (cOwner >= 0 && r[cOwner] != null && String(r[cOwner]).trim() !== "")
          holdersForDelete = String(r[cOwner]).trim();
        else holdersForDelete = [cN1 >= 0 ? r[cN1] : "", cN2 >= 0 ? r[cN2] : ""].filter(Boolean).join(", ");

        const rowAccountNumber =
          cAccNum >= 0 && r[cAccNum] != null && String(r[cAccNum]).trim() !== ""
            ? String(r[cAccNum]).trim()
            : "";

        if (cStatus >= 0 && r[cStatus]) {
          const status = r[cStatus].toString().toLowerCase().trim();
          if (status === "delete" || status === "remove") {
            deleteAccounts.push({
              bank,
              type: cT >= 0 && r[cT] ? r[cT].toString() : "Saving",
              holders: holdersForDelete,
              accountNumber: rowAccountNumber,
            });
            continue;
          }
          if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
        }

        const statusLower = cStatus >= 0 && r[cStatus] ? r[cStatus].toString().toLowerCase().trim() : "";
        const hideFromStatus = statusLower === "hide";
        const hiddenVal =
          hideFromStatus ||
          (cHidden >= 0 && r[cHidden]
            ? ["yes", "true", "1", "y"].includes(r[cHidden].toString().toLowerCase().trim())
            : false);

        const currencyVal = cCur >= 0 && r[cCur] ? r[cCur].toString().trim().toUpperCase() : "INR";
        const nom =
          cNom >= 0 && r[cNom] != null && String(r[cNom]).trim() !== "" ? String(r[cNom]).trim() : "";
        const notesCombined = buildBankNotes(r, cLim, cExtra, cI1, cI2, cDe);
        const chkRaw =
          cChk >= 0 && r[cChk] != null && String(r[cChk]).trim() !== ""
            ? String(r[cChk]).toLowerCase().trim()
            : "";
        const doneFromChecked = ["yes", "true", "1", "y", "✓", "x", "done"].includes(chkRaw);

        let holders = holdersForDelete;
        if (!holders && cN1 < 0 && cN2 < 0) holders = "";

        const nextDueBankYmd = cNextDueAcc >= 0 ? cellToYMD(r[cNextDueAcc]) : null;
        newAccounts.push({
          bank,
          type: cT >= 0 && r[cT] ? r[cT].toString() : "Saving",
          holders,
          nominee: nom,
          amount: cA >= 0 && r[cA] != null ? parseFloat(String(r[cA])) || 0 : 0,
          roi: cR >= 0 && r[cR] != null ? parseFloat(String(r[cR])) || 0 : 0,
          online: cOl >= 0 && r[cOl] ? r[cOl].toString() : "No",
          address: cAd >= 0 && r[cAd] ? r[cAd].toString() : "",
          detail: "",
          notes: notesCombined,
          nextAction: cAc >= 0 && r[cAc] ? r[cAc].toString() : "",
          ...(nextDueBankYmd ? { nextActionDueDate: nextDueBankYmd } : {}),
          currency: currencyVal as Currency,
          hidden: hiddenVal,
          done: doneFromChecked,
          accountNumber: rowAccountNumber,
          ifscCode: cIfsc >= 0 && r[cIfsc] ? r[cIfsc].toString() : "",
          branch: cBranch >= 0 && r[cBranch] ? r[cBranch].toString() : "",
          lastBalanceUpdatedAt: cellToISOStartOfDay(cUpdOn >= 0 ? r[cUpdOn] : null),
        });
      }
    }
  }

  // ── Bills ──
  if (wb.SheetNames.includes("Bills")) {
    const rows = utils.sheet_to_json(wb.Sheets["Bills"], { header: 1, defval: null }) as unknown[][];
    const hIdx = rows.findIndex((r) => r && r.includes("Name") && r.includes("Frequency"));
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const col = (n: string) =>
        h.findIndex((x) => x && x.toString().toLowerCase().includes(n.toLowerCase()));
      const [cN, cF, cA, cD, cP, cPh, cE] = [
        col("Name"),
        col("Freq"),
        col("Amount"),
        col("Date"),
        col("Priority"),
        col("Phone"),
        col("Email"),
      ];
      const cStatus = h.findIndex((x) => x && x.toString().toLowerCase().trim() === "status");
      const cCur = h.findIndex((x) => headerNorm(x) === "currency");
      const cNextBillDue = h.findIndex((x) => {
        if (!x) return false;
        const s = headerNorm(x);
        return (
          (s.includes("next") && s.includes("action") && s.includes("due")) ||
          s === "next action due date" ||
          s === "action due date"
        );
      });
      const cNextBill = h.findIndex((x) => {
        if (!x) return false;
        const s = headerNorm(x);
        if (s.includes("due")) return false;
        return s.includes("next") && s.includes("action");
      });

      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i] as unknown[];
        if (!r || !r[cN]) continue;
        const name = r[cN]?.toString().trim();
        if (!name) continue;
        const nameLower = name.toLowerCase();
        if (nameLower.includes("total") || nameLower.includes("grand") || nameLower.includes("sum")) continue;
        if (cStatus >= 0 && r[cStatus]) {
          const status = r[cStatus].toString().toLowerCase().trim();
          if (status === "delete" || status === "remove") {
            deleteBills.push({ name });
            continue;
          }
          if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
        }
        const hasBillCurrencyCell =
          cCur >= 0 && r[cCur] != null && String(r[cCur]).trim() !== "";
        const nextDueBillYmd = cNextBillDue >= 0 ? cellToYMD(r[cNextBillDue]) : null;
        newBills.push({
          name,
          freq: r[cF]?.toString() || "Monthly",
          amount: parseFloat(String(r[cA])) || 0,
          due: r[cD]?.toString() || "",
          priority: r[cP]?.toString() || "Normal",
          phone: r[cPh]?.toString() || "",
          email: r[cE]?.toString() || "",
          ...(hasBillCurrencyCell ? { currency: normalizeImportCurrency(r[cCur]) } : {}),
          ...(cNextBill >= 0 ? { nextAction: r[cNextBill] != null ? String(r[cNextBill]).trim() : "" } : {}),
          ...(nextDueBillYmd ? { nextActionDueDate: nextDueBillYmd } : {}),
          done: false,
        });
      }
    }
  }

  // ── Actions (manual action items; optional sheet) ──
  if (wb.SheetNames.includes("Actions")) {
    const rows = utils.sheet_to_json(wb.Sheets["Actions"], { header: 1, defval: null }) as unknown[][];
    const hIdx = rows.findIndex(
      (row) =>
        row &&
        row.some((x) => x != null && headerNorm(x) === "title") &&
        row.some((x) => x != null && headerNorm(x) === "bank")
    );
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const colExact = (name: string) =>
        h.findIndex((x) => x != null && headerNorm(x) === name.toLowerCase());
      const cTitle = colExact("title");
      const cBank = colExact("bank");
      const cNote = colExact("note");
      const cPri = colExact("priority");
      let cDue = colExact("next action due date");
      if (cDue < 0) {
        cDue = h.findIndex((x) => {
          if (!x) return false;
          const s = headerNorm(x);
          return (s.includes("next") && s.includes("action") && s.includes("due")) || s === "action due date";
        });
      }
      if (cDue < 0) cDue = colExact("due date");
      const cStatus = colExact("status");
      const cDone = h.findIndex((x) => {
        if (!x) return false;
        const s = headerNorm(x);
        return s === "done" || s === "completed" || s === "checked";
      });

      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i] as unknown[];
        if (!r || cTitle < 0 || r[cTitle] == null || String(r[cTitle]).trim() === "") continue;
        const title = String(r[cTitle]).trim();
        const bank = cBank >= 0 && r[cBank] != null ? String(r[cBank]).trim() : "";
        const titleLower = title.toLowerCase();
        if (titleLower.includes("total") || titleLower.includes("grand") || titleLower.includes("sum")) continue;
        if (cStatus >= 0 && r[cStatus]) {
          const status = String(r[cStatus]).toLowerCase().trim();
          if (status === "delete" || status === "remove") {
            deleteActions.push({ title, bank });
            continue;
          }
          if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
        }
        const dueCell = cDue >= 0 ? cellToYMD(r[cDue]) : null;
        const fromTitle = extractDateFromTitle(title);
        const dateStr = dueCell || fromTitle || "";
        const chkRaw =
          cDone >= 0 && r[cDone] != null && String(r[cDone]).trim() !== ""
            ? String(r[cDone]).toLowerCase().trim()
            : "";
        const doneFromChecked = ["yes", "true", "1", "y", "✓", "x", "done"].includes(chkRaw);
        const priRaw = cPri >= 0 && r[cPri] != null ? String(r[cPri]).trim() : "";
        const priorityVal =
          priRaw && ["Low", "Medium", "High", "Urgent"].includes(priRaw)
            ? (priRaw as ActionItem["priority"])
            : undefined;
        newActions.push({
          title,
          bank,
          date: dateStr,
          note: cNote >= 0 && r[cNote] != null ? String(r[cNote]).trim() : "",
          done: doneFromChecked,
          ...(priorityVal ? { priority: priorityVal } : {}),
        });
      }
    }
  }

  return {
    newDeposits,
    newAccounts,
    newBills,
    newActions,
    deleteDeposits,
    deleteAccounts,
    deleteBills,
    deleteActions,
  };
}

function applyHeaderStyle(ws: Record<string, unknown>, numCols: number) {
  const headerStyle = {
    fill: { fgColor: { rgb: "1F4E79" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };
  const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (let i = 0; i < numCols; i++) {
    const cell = cols[i] + "1";
    const row = ws[cell] as { s?: unknown } | undefined;
    if (row) row.s = headerStyle;
  }
}

/** Build and download the Leo bank-records .xlsx template */
export async function downloadBankRecordsTemplate(filename = "BankRecords_Template.xlsx"): Promise<void> {
  const dateToExcel = (dateStr: string) => {
    const d = new Date(dateStr);
    return EXCEL_EPOCH_OFFSET + d.getTime() / MS_PER_DAY;
  };

  const instructionsData: string[][] = [
    ["📋 BANK RECORDS TEMPLATE - INSTRUCTIONS"],
    [""],
    ["⚠️ IMPORTANT RULES:"],
    ["1. Use the column names below — import finds the header row automatically (rows above it are ignored)"],
    ["2. Deposits, Banks, Bills, and Actions sheets are processed (Actions is optional)"],
    ["3. DO NOT include 'Total' or 'Grand Total' rows - they will be skipped automatically"],
    ["4. Optional: add a cell comment on any header for your own notes (not read by the app today)"],
    [""],
    ["📝 HOW TO USE:"],
    ["1. Fill in your data in the Deposits, Banks, Bills, and (optional) Actions sheets"],
    ["2. Delete the example rows or modify them with your data"],
    ["3. Save the file as .xlsx"],
    ["4. Import it using the Import button in the app"],
    [""],
    ["🚫 SKIP / DELETE ROWS:"],
    ["- Use the 'Status' column to control how rows are processed"],
    ["- SKIP, ARCHIVE, DRAFT, IGNORE, OLD, INACTIVE → Row is skipped (not imported)"],
    ["- DELETE or REMOVE → Matching record is DELETED from dashboard"],
    ["- ACTIVE, KEEP, or blank → Imported/updated normally"],
    ["- HIDE (Banks only) → Imported with hidden: true (Other Accounts). HIDE on Deposits/Bills is ignored (still imported visible)"],
    ["- DELETE uses: Deposits → Bank+DepositID; Banks → Bank+Type+Holders+Account Number; Bills → Name; Actions → Title+Bank"],
    ["- Banks: Same bank + type + holders on multiple rows (e.g. two SCSS) need different Account Number values or the import merges into one row — fill Account Number for each"],
    [""],
    ["💰 CURRENCY SUPPORT:"],
    ["- Supported currencies: INR (₹), USD ($), EUR (€), GBP (£)"],
    ["- Deposits, Banks, and Bills sheets: use a Currency column header (exact match after spacing) — values INR, USD, EUR, or GBP; blank or unknown defaults to INR"],
    ["- Bills row amounts display in the app using that row’s currency"],
    ["- Next Action (Deposits, Bills, Banks): task text shown on Actions tab as a linked row; edit the source row to change"],
    ["- Next Action Due Date (Deposits, Bills, Banks): optional calendar date for that follow-up; also parsed from the task text if empty (e.g. Till May 25, 2025-06-01)"],
    ["- Actions sheet: manual tasks (Title + Bank). Merge/update by Title+Bank. Next Action Due Date column preferred; if blank, a date is parsed from Title when possible"],
    [""],
    ["See Deposits / Banks / Bills / Actions sheets for column order and examples."],
    [""],
    ["💡 TIPS:"],
    ["- Dates: Use Excel date format (select cell > Format as Date)"],
    ["- ROI: Enter as decimal (0.07 = 7%) - app displays as percentage"],
    ["- Amounts: Enter numbers only, no currency symbols"],
    ["- Duration: Free text like '12 months', '1 year', '365 days'"],
    ["- To keep old FDs in Excel but not import: set Status to ARCHIVE"],
  ];

  const depositsHeaders = [
    "Status",
    "Update Date",
    "Bank",
    "Deposit ID",
    "Type",
    "Account Owner",
    "Nominee",
    "Start Date",
    "Deposit",
    "ROI",
    "Maturity Amount",
    "Maturity Date",
    "Duration",
    "Maturity",
    "Currency",
    "Category",
    "TDS Percent",
    "Auto Renewal",
    "Linked Account",
    "Next Action",
    "Next Action Due Date",
    "Notes",
    "Days to Mature",
  ];
  const depositsData = [
    depositsHeaders,
    [
      "ACTIVE",
      dateToExcel("2025-03-01"),
      "ICICI Bank",
      "FD123456",
      "Fixed Deposit",
      "Rahul & Priya",
      "Rahul Kumar",
      dateToExcel("2024-01-15"),
      500000,
      0.072,
      536000,
      dateToExcel("2025-01-15"),
      "12 months",
      "Renew",
      "INR",
      "General Savings",
      10,
      "Yes",
      "ICICI Savings A/C",
      "",
      "",
      "Auto renewal enabled",
      "",
    ],
    [
      "ACTIVE",
      dateToExcel("2025-03-01"),
      "SBI",
      "FD789012",
      "Tax Saver FD",
      "Priya Sharma",
      "Child Nominee",
      dateToExcel("2024-03-01"),
      150000,
      0.068,
      161200,
      dateToExcel("2029-03-01"),
      "5 years",
      "Close",
      "INR",
      "Tax Saving",
      0,
      "No",
      "",
      "Review Form 16",
      dateToExcel("2025-03-15"),
      "Under 80C limit",
      "",
    ],
    [
      "ARCHIVE",
      dateToExcel("2020-01-01"),
      "Old Bank",
      "OLD123",
      "Fixed Deposit",
      "Old Owner",
      "Old Nominee",
      dateToExcel("2020-01-01"),
      100000,
      0.08,
      140000,
      dateToExcel("2025-01-01"),
      "5 years",
      "Closed",
      "INR",
      "General Savings",
      0,
      "No",
      "",
      "",
      "",
      "Not imported (ARCHIVE)",
      "",
    ],
  ];

  const banksHeaders = [
    "Status",
    "Updated On",
    "Source",
    "Amount",
    "Type",
    "Currency",
    "Next Action",
    "Next Action Due Date",
    "Account Owner",
    "Nominee",
    "Online",
    "ROI",
    "Limits",
    "Account Number",
    "Extra Info",
    "Address",
    "Info 1",
    "Info 2",
    "IFSC Code",
    "Branch",
    "Hidden",
    "Checked",
  ];
  const banksData = [
    banksHeaders,
    [
      "ACTIVE",
      dateToExcel("2025-03-01"),
      "HDFC Bank",
      150000,
      "Saving",
      "INR",
      "Update KYC",
      dateToExcel("2025-04-01"),
      "Rahul Kumar",
      "Priya Kumar",
      "Yes",
      0.035,
      "ATM 50k",
      "50100123456789",
      "Primary savings",
      "Andheri West, Mumbai",
      "Nom reg note",
      "Jio linked",
      "HDFC0001234",
      "Andheri West",
      "No",
      "No",
    ],
    [
      "HIDE",
      dateToExcel("2024-12-01"),
      "SBI",
      25000,
      "Current",
      "INR",
      "",
      "",
      "Kumar Enterprises",
      "",
      "Yes",
      0,
      "POS 1L",
      "32105678901",
      "",
      "Noida Sector 18",
      "",
      "",
      "SBIN0012345",
      "Noida Sec 18",
      "No",
      "No",
    ],
    [
      "SKIP",
      dateToExcel("2020-01-01"),
      "Closed Bank",
      0,
      "Saving",
      "INR",
      "",
      "",
      "Old Account",
      "",
      "No",
      0,
      "",
      "",
      "Closed",
      "",
      "",
      "",
      "",
      "",
      "No",
      "No",
    ],
  ];

  const billsHeaders = [
    "Status",
    "Name",
    "Frequency",
    "Amount",
    "Date",
    "Priority",
    "Phone",
    "Email",
    "Next Action",
    "Next Action Due Date",
    "Currency",
    "Category",
    "Auto Pay",
  ];
  const billsData = [
    billsHeaders,
    ["KEEP", "Electricity Bill", "Monthly", 2500, "15th", "High", "1800-123-456", "support@power.com", "Compare plans", dateToExcel("2025-03-10"), "INR", "Utility", "No"],
    ["ACTIVE", "Internet - Airtel", "Monthly", 999, "1st", "Normal", "1800-987-654", "support@airtel.com", "", "", "INR", "Utility", "Yes"],
    ["SKIP", "Old Subscription", "Monthly", 0, "", "Low", "", "", "", "", "INR", "", "This row will NOT be imported"],
  ];

  const actionsHeaders = ["Status", "Title", "Bank", "Next Action Due Date", "Note", "Priority", "Done"];
  const actionsData = [
    actionsHeaders,
    [
      "ACTIVE",
      "Renew locker agreement",
      "SBI",
      dateToExcel("2025-04-15"),
      "Visit branch with ID",
      "High",
      "No",
    ],
    [
      "ACTIVE",
      "Till May 25 — confirm nominee",
      "DCU",
      "",
      "Parsed date from title if Due Date empty",
      "Medium",
      "No",
    ],
  ];

  const wb = utils.book_new();

  const wsInstructions = utils.aoa_to_sheet(instructionsData);
  wsInstructions["!cols"] = [{ wch: 80 }];
  utils.book_append_sheet(wb, wsInstructions, "Instructions");

  const wsDeposits = utils.aoa_to_sheet(depositsData);
  wsDeposits["!cols"] = Array.from({ length: depositsHeaders.length }, (_, i) => ({
    wch: [1, 7, 11].includes(i) ? 12 : i === 20 ? 14 : [8, 10].includes(i) ? 12 : 11,
  }));
  for (let r = 2; r <= 4; r++) {
    ["B", "H", "L", "T"].forEach((col) => {
      const c = col + r;
      if (wsDeposits[c]) (wsDeposits[c] as { z?: string }).z = "yyyy-mm-dd";
    });
    ["I", "K"].forEach((col) => {
      const c = col + r;
      if (wsDeposits[c]) (wsDeposits[c] as { z?: string }).z = "#,##0";
    });
    const cj = "J" + r;
    if (wsDeposits[cj]) (wsDeposits[cj] as { z?: string }).z = "0.00%";
  }
  applyHeaderStyle(wsDeposits as Record<string, unknown>, depositsHeaders.length);
  utils.book_append_sheet(wb, wsDeposits, "Deposits");

  const wsBanks = utils.aoa_to_sheet(banksData);
  wsBanks["!cols"] = Array.from({ length: banksHeaders.length }, () => ({ wch: 12 }));
  for (let r = 2; r <= 4; r++) {
    const b = "B" + r;
    if (wsBanks[b]) (wsBanks[b] as { z?: string }).z = "yyyy-mm-dd";
    const h = "H" + r;
    if (wsBanks[h]) (wsBanks[h] as { z?: string }).z = "yyyy-mm-dd";
    const d = "D" + r;
    if (wsBanks[d]) (wsBanks[d] as { z?: string }).z = "#,##0";
    const l = "L" + r;
    if (wsBanks[l]) (wsBanks[l] as { z?: string }).z = "0.00%";
  }
  applyHeaderStyle(wsBanks as Record<string, unknown>, banksHeaders.length);
  utils.book_append_sheet(wb, wsBanks, "Banks");

  const wsBills = utils.aoa_to_sheet(billsData);
  wsBills["!cols"] = [
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 25 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
  ];
  for (let r = 2; r <= 4; r++) {
    const c = "D" + r;
    if (wsBills[c]) (wsBills[c] as { z?: string }).z = "#,##0.00";
    const j = "J" + r;
    if (wsBills[j]) (wsBills[j] as { z?: string }).z = "yyyy-mm-dd";
  }
  applyHeaderStyle(wsBills as Record<string, unknown>, billsHeaders.length);
  utils.book_append_sheet(wb, wsBills, "Bills");

  const wsActions = utils.aoa_to_sheet(actionsData);
  wsActions["!cols"] = Array.from({ length: actionsHeaders.length }, (_, i) => ({ wch: i === 1 ? 28 : i === 4 ? 24 : 12 }));
  for (let r = 2; r <= 3; r++) {
    const d = "D" + r;
    if (wsActions[d]) (wsActions[d] as { z?: string }).z = "yyyy-mm-dd";
  }
  applyHeaderStyle(wsActions as Record<string, unknown>, actionsHeaders.length);
  utils.book_append_sheet(wb, wsActions, "Actions");

  writeFile(wb, filename);
}
