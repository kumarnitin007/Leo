import fs from "fs";
const path = new URL("../src/components/BankDashboard.tsx", import.meta.url);
const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);
const slice = lines.slice(1209, 1820);
const dedented = slice.map((line) => line.replace(/^ {6}/, ""));
fs.writeFileSync(
  new URL("../src/components/bank/_overview_body.txt", import.meta.url),
  dedented.join("\n"),
  "utf8"
);
console.log("lines", dedented.length, "first", dedented[0]?.slice(0, 60));
