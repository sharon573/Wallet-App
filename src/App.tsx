import { useState } from "react";
import type { ReactNode } from "react";
import { FrameRoot } from "@dust/frame";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Info,
  Mail,
  MessageSquare,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { theme } from "./theme";

type Cur = "XOF" | "USD";
type Freq = "m" | "t" | "a";
type Rep = "once" | "inf" | "lim";
type Tone = "good" | "warn" | "bad";

type FixedRow = { on: boolean; amount: string; freq: Freq };
type CreditRow = { on: boolean; amount: string; restantes: string };
type SavRow = { on: boolean; solde: string; v: string; rep: Rep; months: string };
type Tontine = { on: boolean; cot: string; n: string; t: string; m: string };

const FIXED_CATS: { id: string; label: string; freq: Freq }[] = [
  { id: "loyer", label: "Loyer", freq: "m" },
  { id: "assurances", label: "Assurances", freq: "m" },
  { id: "scolarite", label: "Scolarité", freq: "t" },
  { id: "banque", label: "Frais bancaires", freq: "m" },
  { id: "internet", label: "Internet fixe", freq: "m" },
  { id: "abos", label: "Abonnements digitaux", freq: "m" },
  { id: "energie", label: "Énergie et eau", freq: "m" },
  { id: "mobile", label: "Téléphone mobile", freq: "m" },
  { id: "transport", label: "Transport (abonnement)", freq: "m" },
  { id: "sante", label: "Santé ou mutuelle", freq: "m" },
  { id: "famille", label: "Aide régulière à la famille", freq: "m" },
  { id: "autres", label: "Autres charges fixes", freq: "m" },
];
const CREDIT_CATS = [
  { id: "immo", label: "Crédit immo" },
  { id: "conso", label: "Crédit conso" },
  { id: "achat", label: "Achat à crédit" },
  { id: "autre", label: "Autre crédit ou prêt à un proche" },
];
const SAV_CATS = [
  { id: "epargne", label: "Compte épargne" },
  { id: "cash", label: "Espèces ou Mobile Money non bloqué" },
  { id: "bloque", label: "Compte bloqué Mobile Money" },
  { id: "autre", label: "Autre épargne" },
];

const FREQ_LABEL: Record<Freq, string> = { m: "par mois", t: "par trimestre", a: "par an" };
const STEPS = ["Revenu", "Charges fixes", "Crédits", "Épargne", "Foyer"];

const num = (s: string) => Number(s) || 0;
const digits = (s: string) => s.replace(/[^0-9]/g, "");
const monthly = (amount: number, f: Freq) => (f === "m" ? amount : f === "t" ? amount / 3 : amount / 12);

function makeFmt(cur: Cur) {
  return (n: number) =>
    cur === "XOF"
      ? `${Math.round(n).toLocaleString("fr-FR")} FCFA`
      : `${Math.round(n).toLocaleString("fr-FR")} $`;
}
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")} %`;

const initFixed = (): Record<string, FixedRow> =>
  Object.fromEntries(FIXED_CATS.map((c) => [c.id, { on: false, amount: "", freq: c.freq }]));
const initCredit = (): Record<string, CreditRow> =>
  Object.fromEntries(CREDIT_CATS.map((c) => [c.id, { on: false, amount: "", restantes: "" }]));
const initSav = (): Record<string, SavRow> =>
  Object.fromEntries(SAV_CATS.map((c) => [c.id, { on: false, solde: "", v: "", rep: "inf" as Rep, months: "" }]));
const emptySavRow = (): SavRow => ({ on: true, solde: "", v: "", rep: "inf", months: "" });
const initTontine = (): Tontine => ({ on: false, cot: "", n: "", t: "", m: "" });

/* ---------- small UI pieces ---------- */

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: `var(--${tone})`, backgroundColor: `var(--${tone}-soft)` }}
    >
      {children}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  inputMode?: "text" | "numeric" | "email" | "tel";
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold text-card-foreground outline-none ${readOnly ? "bg-muted" : "bg-card"}`}
      />
      {error ? <span className="mt-1 block text-xs font-medium" style={{ color: "var(--bad)" }}>{error}</span> : null}
    </label>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center rounded-xl border border-border bg-card px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(digits(e.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-card-foreground outline-none"
        />
        <span className="ml-2 text-xs text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

function NumberInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(digits(e.target.value))}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-card-foreground outline-none"
      />
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-1 rounded-full bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChipPicker({
  items,
  isOn,
  onToggle,
}: {
  items: { id: string; label: string }[];
  isOn: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = isOn(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"
            }`}
          >
            {on ? <Check size={12} /> : <Plus size={12} />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function RowCard({ title, onRemove, children }: { title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-card-foreground">{title}</p>
        <button type="button" onClick={onRemove} aria-label={`Retirer ${title}`} className="rounded-full p-1 text-muted-foreground">
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}

function TotalBar({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-secondary p-3 text-secondary-foreground">
      <div>
        <p className="text-xs font-medium">{label}</p>
        {sub ? <p className="text-xs opacity-80">{sub}</p> : null}
      </div>
      <p className="text-lg font-bold" style={{ fontFamily: "var(--font-serif)" }}>
        {value}
      </p>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-border p-3 text-xs text-muted-foreground">
      <Info size={14} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function SavFields({
  row,
  onChange,
  cur,
  showSolde = true,
}: {
  row: SavRow;
  onChange: (r: SavRow) => void;
  cur: string;
  showSolde?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showSolde && <MoneyInput label="Solde actuel" value={row.solde} onChange={(v) => onChange({ ...row, solde: v })} suffix={cur} />}
      <MoneyInput label="Versement" value={row.v} onChange={(v) => onChange({ ...row, v })} suffix={cur} />
      <Select
        label="Répétition du versement"
        value={row.rep}
        onChange={(v) => onChange({ ...row, rep: v as Rep })}
        options={[
          { value: "once", label: "Une seule fois" },
          { value: "inf", label: "Chaque mois, sans limite de durée" },
          { value: "lim", label: "Chaque mois, pendant un temps limité" },
        ]}
      />
      {row.rep === "lim" && (
        <NumberInput label="Nombre de mois restants" value={row.months} onChange={(v) => onChange({ ...row, months: v })} />
      )}
    </div>
  );
}

const savMonthly = (r: SavRow) => (r.rep === "once" ? 0 : r.rep === "lim" && num(r.months) <= 0 ? 0 : num(r.v));

/* ---------- Tontine card (shared between Crédits and Épargne) ---------- */

function tontineInfo(t: Tontine) {
  const cot = num(t.cot);
  const n = num(t.n);
  const tour = num(t.t);
  const m = num(t.m);
  const complete = t.on && cot > 0 && n > 0 && tour > 0;
  const invalid = complete && tour > n;
  const finished = complete && !invalid && m >= n;
  const dette = complete && !invalid && !finished && m >= tour;
  const epargne = complete && !invalid && !finished && !dette;
  return { cot, n, tour, m, complete, invalid, finished, dette, epargne, restantes: Math.max(0, n - m) };
}

function TontineCard({
  t,
  onChange,
  fmt,
  cur,
}: {
  t: Tontine;
  onChange: (t: Tontine) => void;
  fmt: (n: number) => string;
  cur: string;
}) {
  const info = tontineInfo(t);
  return (
    <RowCard title="Tontine" onRemove={() => onChange({ ...t, on: false })}>
      <MoneyInput label="Montant de la cotisation (par mois)" value={t.cot} onChange={(v) => onChange({ ...t, cot: v })} suffix={cur} />
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Nombre total de mois de cotisation" value={t.n} onChange={(v) => onChange({ ...t, n: v })} />
        <NumberInput label="Mois où vous récupérez votre tour" value={t.t} onChange={(v) => onChange({ ...t, t: v })} />
      </div>
      <NumberInput
        label="Mois déjà cotisés"
        value={t.m}
        onChange={(v) => onChange({ ...t, m: v })}
        hint="Ce nombre se met à jour automatiquement chaque mois."
      />
      {!info.complete && (
        <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">Renseignez ces informations pour classer votre tontine.</p>
      )}
      {info.invalid && (
        <p className="rounded-xl p-2 text-xs font-medium" style={{ color: "var(--bad)", backgroundColor: "var(--bad-soft)" }}>
          Le mois du tour ne peut pas dépasser la durée totale.
        </p>
      )}
      {info.epargne && (
        <p className="rounded-xl p-2 text-xs font-medium" style={{ color: "var(--good)", backgroundColor: "var(--good-soft)" }}>
          Votre tour n'est pas encore passé : cette tontine est comptée dans votre <b>épargne</b> (solde {fmt(info.cot * info.m)}, cotisation de {fmt(info.cot)} par mois).
        </p>
      )}
      {info.dette && (
        <p className="rounded-xl p-2 text-xs font-medium" style={{ color: "var(--warn)", backgroundColor: "var(--warn-soft)" }}>
          Votre tour est passé : cette tontine est comptée dans vos <b>crédits</b> ({fmt(info.cot)} par mois, il reste {info.restantes} mensualités).
        </p>
      )}
      {info.finished && (
        <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">Tontine terminée : elle n'est plus comptée.</p>
      )}
    </RowCard>
  );
}

/* ---------- App ---------- */

export default function App() {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"signup" | "code" | "flow">("signup");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [cc, setCc] = useState("+221");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [google, setGoogle] = useState(false);
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [codeResent, setCodeResent] = useState(false);
  const [chEmail, setChEmail] = useState(true);
  const [chSms, setChSms] = useState(false);
  const [monthly2, setMonthly2] = useState(true);
  const [sent, setSent] = useState(false);
  const [started, setStarted] = useState(false);

  const [cur, setCur] = useState<Cur>("XOF");
  const [revenu, setRevenu] = useState("");
  const [variable, setVariable] = useState(false);

  const [fixedMode, setFixedMode] = useState<"total" | "detail">("detail");
  const [fixedTotal, setFixedTotal] = useState("");
  const [fixedRows, setFixedRows] = useState<Record<string, FixedRow>>(initFixed);

  const [noCredit, setNoCredit] = useState(false);
  const [creditRows, setCreditRows] = useState<Record<string, CreditRow>>(initCredit);
  const [tontine, setTontine] = useState<Tontine>(initTontine);

  const [savMode, setSavMode] = useState<"total" | "detail">("detail");
  const [savTotalRow, setSavTotalRow] = useState<SavRow>(emptySavRow);
  const [savRows, setSavRows] = useState<Record<string, SavRow>>(initSav);

  const [household, setHousehold] = useState(1);

  const fmt = makeFmt(cur);
  const suffix = cur === "XOF" ? "FCFA" : "$";

  /* computations */
  const R = num(revenu);
  const fixedSum = FIXED_CATS.reduce((s, c) => {
    const r = fixedRows[c.id];
    return r.on ? s + monthly(num(r.amount), r.freq) : s;
  }, 0);
  const F = fixedMode === "total" ? num(fixedTotal) : fixedSum;

  const tInfo = tontineInfo(tontine);
  const creditSum = noCredit ? 0 : CREDIT_CATS.reduce((s, c) => (creditRows[c.id].on ? s + num(creditRows[c.id].amount) : s), 0);
  const tontineDette = !noCredit && tInfo.dette ? tInfo.cot : 0;
  const C = creditSum + tontineDette;

  const savSolde =
    savMode === "total"
      ? num(savTotalRow.solde)
      : SAV_CATS.reduce((s, c) => (savRows[c.id].on ? s + num(savRows[c.id].solde) : s), 0) + (tInfo.epargne ? tInfo.cot * tInfo.m : 0);
  const V =
    savMode === "total"
      ? savMonthly(savTotalRow)
      : SAV_CATS.reduce((s, c) => (savRows[c.id].on ? s + savMonthly(savRows[c.id]) : s), 0) + (tInfo.epargne ? tInfo.cot : 0);

  const fillExample = () => {
    setCur("XOF");
    setRevenu("350000");
    setVariable(false);
    setFixedMode("detail");
    const fr = initFixed();
    fr.loyer = { on: true, amount: "80000", freq: "m" };
    fr.scolarite = { on: true, amount: "120000", freq: "t" };
    fr.energie = { on: true, amount: "15000", freq: "m" };
    fr.internet = { on: true, amount: "15000", freq: "m" };
    fr.mobile = { on: true, amount: "10000", freq: "m" };
    fr.famille = { on: true, amount: "30000", freq: "m" };
    setFixedRows(fr);
    setNoCredit(false);
    const cr = initCredit();
    cr.conso = { on: true, amount: "25000", restantes: "8" };
    setCreditRows(cr);
    setTontine({ on: true, cot: "20000", n: "10", t: "6", m: "4" });
    setSavMode("detail");
    const sr = initSav();
    sr.epargne = { on: true, solde: "150000", v: "20000", rep: "inf", months: "" };
    sr.bloque = { on: true, solde: "60000", v: "0", rep: "once", months: "" };
    setSavRows(sr);
    setHousehold(4);
    setStep(0);
    setStarted(false);
    if (first.trim() === "") {
      setFirst("Fatou");
      setLast("Ndiaye");
      setEmail("fatou.ndiaye@gmail.com");
      setPhone("77 123 45 67");
      setGoogle(true);
      setConsent(true);
    }
    setPhase("flow");
    setSent(false);
  };
  const reset = () => {
    setPhase("signup");
    setFirst("");
    setLast("");
    setPhone("");
    setEmail("");
    setGoogle(false);
    setConsent(false);
    setTouched(false);
    setSent(false);
    setChEmail(true);
    setChSms(false);
    setStep(0);
    setStarted(false);
    setCur("XOF");
    setRevenu("");
    setVariable(false);
    setFixedMode("detail");
    setFixedTotal("");
    setFixedRows(initFixed());
    setNoCredit(false);
    setCreditRows(initCredit());
    setTontine(initTontine());
    setSavMode("detail");
    setSavTotalRow(emptySavRow());
    setSavRows(initSav());
    setHousehold(1);
  };

  const phoneOk = digits(phone).length >= 8;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const signupOk = first.trim() !== "" && last.trim() !== "" && phoneOk && emailOk && consent;
  const fullPhone = `${cc} ${phone.trim()}`;
  const useGoogle = () => {
    setFirst("Fatou");
    setLast("Ndiaye");
    setEmail("fatou.ndiaye@gmail.com");
    setGoogle(true);
  };
  const submitSignup = () => {
    setTouched(true);
    if (signupOk) {
      setCode("");
      setCodeErr("");
      setCodeResent(false);
      setPhase("code");
    }
  };
  const submitCode = () => {
    if (code === "1234") {
      setCodeErr("");
      setPhase("flow");
    } else {
      setCodeErr("Code incorrect. Vérifiez le SMS reçu et réessayez.");
    }
  };

  const canNext = step !== 0 || R > 0;
  const isResult = step === 5;

  /* result indicators */
  const tauxEndet = R > 0 ? C / R : 0;
  const rav = R > 0 ? (R - F - C) / R : 0;
  const tauxEpargne = R > 0 ? V / R : 0;
  const noteLower = (v: number, g: number, o: number) => (v < g ? 2 : v <= o ? 1 : 0);
  const noteHigher = (v: number, g: number, o: number) => (v >= g ? 2 : v >= o ? 1 : 0);
  const nEnd = noteLower(tauxEndet, 0.25, 0.35);
  const nRav = noteHigher(rav, 0.4, 0.25);
  const nEpa = noteHigher(tauxEpargne, 0.15, 0.05);
  const toneOf = (n: number): Tone => (n === 2 ? "good" : n === 1 ? "warn" : "bad");
  const score = ((nEnd / 2) * 20 + (nRav / 2) * 15 + (nEpa / 2) * 10) / 45;
  const statusTone: Tone = rav < 0 ? "bad" : score >= 0.7 ? "good" : score >= 0.4 ? "warn" : "bad";
  const statusLabel = statusTone === "good" ? "Solide" : statusTone === "warn" ? "À surveiller" : "Fragile";

  const indicators = [
    {
      id: "end",
      label: "Taux d'endettement",
      value: pct(tauxEndet),
      note: nEnd,
      pill: nEnd === 2 ? "Bon" : nEnd === 1 ? "Attention" : "Élevé",
      msg:
        C <= 0
          ? "Aucun crédit déclaré."
          : nEnd === 2
            ? "Vos crédits pèsent moins de 25 % de vos revenus."
            : nEnd === 1
              ? "Vos crédits pèsent entre 25 % et 35 % de vos revenus."
              : "Vos crédits dépassent 35 % de vos revenus.",
    },
    {
      id: "rav",
      label: "Reste à vivre",
      value: pct(rav),
      note: nRav,
      pill: nRav === 2 ? "Confortable" : nRav === 1 ? "Serré" : "Très serré",
      msg:
        rav < 0
          ? "Vos charges fixes et crédits dépassent votre revenu."
          : nRav === 2
            ? "Plus de 40 % de votre revenu reste après vos charges fixes et crédits."
            : nRav === 1
              ? "Entre 25 % et 40 % de votre revenu reste après vos charges fixes et crédits."
              : "Moins de 25 % de votre revenu reste après vos charges fixes et crédits.",
    },
    {
      id: "epa",
      label: "Taux d'épargne",
      value: pct(tauxEpargne),
      note: nEpa,
      pill: nEpa === 2 ? "Bon" : nEpa === 1 ? "Moyen" : "Faible",
      msg:
        V <= 0
          ? "Aucun versement mensuel d'épargne déclaré."
          : nEpa === 2
            ? "Vous épargnez au moins 15 % de votre revenu."
            : nEpa === 1
              ? "Vous épargnez entre 5 % et 15 % de votre revenu."
              : "Vous épargnez moins de 5 % de votre revenu.",
    },
  ];

  const bar = ((step + 1) / 6) * 100;

  return (
    <FrameRoot theme={theme} className="min-h-screen bg-muted px-4 py-6">
      <div className="mx-auto max-w-sm space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Maquette · première connexion</p>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
            Saisie des informations de départ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Parcourez les étapes, ou remplissez un exemple pour voir le résultat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fillExample} className="flex items-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            <Sparkles size={14} /> Remplir un exemple
          </button>
          <button type="button" onClick={reset} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground">
            Tout effacer
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border-4 border-foreground bg-background shadow-xl">
          {/* header */}
          <div className="bg-primary px-5 pb-4 pt-3 text-primary-foreground">
            <p className="text-xs opacity-80">{phase === "signup" ? "Bienvenue" : phase === "code" ? "Sécurité" : isResult ? "Terminé" : `Étape ${step + 1} sur 5`}</p>
            <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
              {phase === "signup" ? "Créer mon compte" : phase === "code" ? "Vérifier mon numéro" : isResult ? "Votre situation de départ" : STEPS[step]}
            </p>
            {phase === "flow" && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${bar}%`, transition: "width 0.3s" }} />
              </div>
            )}
          </div>

          <div className="space-y-4 p-4">
            {phase === "signup" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Créez votre compte pour sauvegarder vos informations et recevoir votre situation financière.
                </p>
                <button
                  type="button"
                  onClick={useGoogle}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-bold text-card-foreground"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">G</span>
                  Continuer avec Google
                </button>
                {google ? (
                  <div className="flex items-start justify-between gap-2 rounded-xl p-3 text-xs font-medium" style={{ color: "var(--good)", backgroundColor: "var(--good-soft)" }}>
                    <p>Connecté avec Google : nous avons récupéré votre nom et votre e-mail. Il manque seulement votre numéro de téléphone.</p>
                    <button type="button" onClick={() => setGoogle(false)} className="shrink-0 font-bold underline">Modifier</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> ou avec vos informations <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <TextInput label="Prénom" value={first} onChange={setFirst} placeholder="Fatou" readOnly={google} error={touched && first.trim() === "" ? "Obligatoire" : undefined} />
                  <TextInput label="Nom" value={last} onChange={setLast} placeholder="Ndiaye" readOnly={google} error={touched && last.trim() === "" ? "Obligatoire" : undefined} />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Numéro de téléphone</span>
                  <div className="flex gap-2">
                    <select value={cc} onChange={(e) => setCc(e.target.value)} className="rounded-xl border border-border bg-card px-2 py-2 text-sm font-semibold text-card-foreground outline-none">
                      {["+221", "+225", "+223", "+229", "+228", "+237", "+33"].map((x) => (<option key={x} value={x}>{x}</option>))}
                    </select>
                    <input
                      type="text"
                      inputMode="tel"
                      value={phone}
                      placeholder="77 123 45 67"
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9 ]/g, ""))}
                      className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-card-foreground outline-none"
                    />
                  </div>
                  {touched && !phoneOk ? <span className="mt-1 block text-xs font-medium" style={{ color: "var(--bad)" }}>Entrez un numéro valide.</span> : <span className="mt-1 block text-xs text-muted-foreground">Un code de vérification vous sera envoyé par SMS.</span>}
                </div>
                <TextInput label="Adresse e-mail" value={email} onChange={setEmail} placeholder="prenom.nom@email.com" type="email" inputMode="email" readOnly={google} error={touched && !emailOk ? "Entrez une adresse e-mail valide." : undefined} />
                <div>
                  <button type="button" onClick={() => setConsent(!consent)} className="flex items-start gap-2 text-left text-sm text-card-foreground">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${consent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                      {consent && <Check size={14} />}
                    </span>
                    J'accepte les conditions d'utilisation et le traitement de mes données personnelles.
                  </button>
                  {touched && !consent && <span className="mt-1 block text-xs font-medium" style={{ color: "var(--bad)" }}>Votre accord est nécessaire pour créer le compte.</span>}
                </div>
                <Hint>Vos informations servent à créer votre compte, à sécuriser l'accès et à vous envoyer votre situation financière. Elles ne sont jamais partagées sans votre accord.</Hint>
                <button type="button" onClick={submitSignup} className={`flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-bold ${signupOk ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  Créer mon compte <ArrowRight size={16} />
                </button>
              </div>
            )}

            {phase === "code" && (
              <div className="space-y-4">
                <p className="text-sm text-card-foreground">Nous avons envoyé un code à 4 chiffres par SMS au <b>{fullPhone}</b>.</p>
                <TextInput label="Code reçu par SMS" value={code} onChange={(v) => setCode(digits(v).slice(0, 4))} placeholder="••••" inputMode="numeric" error={codeErr || undefined} />
                <Hint>Maquette : le code de démonstration est 1234.</Hint>
                <button type="button" disabled={code.length < 4} onClick={submitCode} className={`flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-bold ${code.length === 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  Valider <ArrowRight size={16} />
                </button>
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <button type="button" onClick={() => setCodeResent(true)}>Renvoyer le code</button>
                  <button type="button" onClick={() => setPhase("signup")}>Modifier mon numéro</button>
                </div>
                {codeResent && <p className="text-xs" style={{ color: "var(--good)" }}>Un nouveau code vient d'être envoyé.</p>}
              </div>
            )}

            {phase === "flow" && (
              <>
            {/* STEP 0: revenu */}
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bienvenue. Quelques informations suffisent pour une première estimation. Vous les saisissez une fois, elles se répètent chaque mois.
                </p>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Devise</p>
                  <Segmented
                    value={cur}
                    onChange={(v) => setCur(v as Cur)}
                    options={[
                      { value: "XOF", label: "FCFA" },
                      { value: "USD", label: "Dollars" },
                    ]}
                  />
                </div>
                <MoneyInput label="Revenu net mensuel" value={revenu} onChange={setRevenu} suffix={suffix} />
                <button type="button" onClick={() => setVariable(!variable)} className="flex items-center gap-2 text-left text-sm text-card-foreground">
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${variable ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                    {variable && <Check size={14} />}
                  </span>
                  Mon revenu varie
                </button>
                {variable && <Hint>Indiquez la moyenne de vos 3 derniers mois.</Hint>}
              </div>
            )}

            {/* STEP 1: charges fixes */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Loyer, assurances, scolarité... Ce que vous payez à intervalle régulier, hors crédits.</p>
                <Segmented
                  value={fixedMode}
                  onChange={(v) => setFixedMode(v as "total" | "detail")}
                  options={[
                    { value: "total", label: "Je connais le total" },
                    { value: "detail", label: "Je détaille" },
                  ]}
                />
                {fixedMode === "total" ? (
                  <MoneyInput label="Total de mes charges fixes (par mois)" value={fixedTotal} onChange={setFixedTotal} suffix={suffix} />
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Touchez les catégories qui vous concernent : les montants se cumulent.</p>
                    <ChipPicker
                      items={FIXED_CATS}
                      isOn={(id) => fixedRows[id].on}
                      onToggle={(id) => setFixedRows({ ...fixedRows, [id]: { ...fixedRows[id], on: !fixedRows[id].on } })}
                    />
                    {FIXED_CATS.filter((c) => fixedRows[c.id].on).map((c) => {
                      const r = fixedRows[c.id];
                      return (
                        <RowCard key={c.id} title={c.label} onRemove={() => setFixedRows({ ...fixedRows, [c.id]: { ...r, on: false } })}>
                          <div className="grid grid-cols-2 gap-3">
                            <MoneyInput label="Montant" value={r.amount} onChange={(v) => setFixedRows({ ...fixedRows, [c.id]: { ...r, amount: v } })} suffix={suffix} />
                            <Select
                              label="Fréquence"
                              value={r.freq}
                              onChange={(v) => setFixedRows({ ...fixedRows, [c.id]: { ...r, freq: v as Freq } })}
                              options={[
                                { value: "m", label: FREQ_LABEL.m },
                                { value: "t", label: FREQ_LABEL.t },
                                { value: "a", label: FREQ_LABEL.a },
                              ]}
                            />
                          </div>
                          {r.freq !== "m" && num(r.amount) > 0 && (
                            <p className="text-xs text-muted-foreground">Soit {fmt(monthly(num(r.amount), r.freq))} par mois</p>
                          )}
                        </RowCard>
                      );
                    })}
                  </div>
                )}
                <TotalBar label="Total des charges fixes" value={fmt(F)} sub="par mois" />
              </div>
            )}

            {/* STEP 2: crédits */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Les crédits que vous remboursez en ce moment.</p>
                <button
                  type="button"
                  onClick={() => setNoCredit(!noCredit)}
                  className={`w-full rounded-full border px-3 py-2 text-sm font-medium ${noCredit ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"}`}
                >
                  {noCredit ? "Je n'ai aucun crédit en cours" : "Je n'ai aucun crédit"}
                </button>
                {!noCredit && (
                  <div className="space-y-3">
                    <ChipPicker
                      items={[...CREDIT_CATS, { id: "tontine", label: "Tontine" }]}
                      isOn={(id) => (id === "tontine" ? tontine.on : creditRows[id].on)}
                      onToggle={(id) =>
                        id === "tontine"
                          ? setTontine({ ...tontine, on: !tontine.on })
                          : setCreditRows({ ...creditRows, [id]: { ...creditRows[id], on: !creditRows[id].on } })
                      }
                    />
                    {CREDIT_CATS.filter((c) => creditRows[c.id].on).map((c) => {
                      const r = creditRows[c.id];
                      return (
                        <RowCard key={c.id} title={c.label} onRemove={() => setCreditRows({ ...creditRows, [c.id]: { ...r, on: false } })}>
                          <div className="grid grid-cols-2 gap-3">
                            <MoneyInput label="Montant de la mensualité" value={r.amount} onChange={(v) => setCreditRows({ ...creditRows, [c.id]: { ...r, amount: v } })} suffix={suffix} />
                            <NumberInput label="Mensualités restantes" value={r.restantes} onChange={(v) => setCreditRows({ ...creditRows, [c.id]: { ...r, restantes: v } })} />
                          </div>
                        </RowCard>
                      );
                    })}
                    {tontine.on && <TontineCard t={tontine} onChange={setTontine} fmt={fmt} cur={suffix} />}
                  </div>
                )}
                <TotalBar label="Total des mensualités de crédit" value={fmt(C)} sub={tontineDette > 0 ? "dont tontine (tour passé)" : "par mois"} />
              </div>
            )}

            {/* STEP 3: épargne */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Ce que vous avez mis de côté, et ce que vous versez chaque mois.</p>
                <Segmented
                  value={savMode}
                  onChange={(v) => setSavMode(v as "total" | "detail")}
                  options={[
                    { value: "total", label: "Je connais le total" },
                    { value: "detail", label: "Je détaille" },
                  ]}
                />
                {savMode === "total" ? (
                  <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
                    <SavFields row={savTotalRow} onChange={setSavTotalRow} cur={suffix} />
                    <Hint>Vous avez une tontine ? Passez au détail pour qu'elle soit classée correctement.</Hint>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ChipPicker
                      items={[...SAV_CATS, { id: "tontine", label: "Tontine" }]}
                      isOn={(id) => (id === "tontine" ? tontine.on : savRows[id].on)}
                      onToggle={(id) =>
                        id === "tontine"
                          ? setTontine({ ...tontine, on: !tontine.on })
                          : setSavRows({ ...savRows, [id]: { ...savRows[id], on: !savRows[id].on } })
                      }
                    />
                    {SAV_CATS.filter((c) => savRows[c.id].on).map((c) => (
                      <RowCard key={c.id} title={c.label} onRemove={() => setSavRows({ ...savRows, [c.id]: { ...savRows[c.id], on: false } })}>
                        <SavFields row={savRows[c.id]} onChange={(r) => setSavRows({ ...savRows, [c.id]: r })} cur={suffix} />
                      </RowCard>
                    ))}
                    {tontine.on && <TontineCard t={tontine} onChange={setTontine} fmt={fmt} cur={suffix} />}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <TotalBar label="Épargne totale" value={fmt(savSolde)} />
                  <TotalBar label="Versement mensuel" value={fmt(V)} />
                </div>
              </div>
            )}

            {/* STEP 4: foyer */}
            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Combien de personnes dépendent de ce revenu, vous inclus ?</p>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setHousehold(n)}
                      className={`rounded-xl border py-3 text-sm font-semibold ${household === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"}`}
                    >
                      {n === 10 ? "10+" : n}
                    </button>
                  ))}
                </div>
                <Hint>Cela inclut les personnes que vous soutenez, même si elles ne vivent pas chez vous.</Hint>
              </div>
            )}

            {/* RESULT */}
            {isResult && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">Situation de départ</p>
                  <div className="mt-2 flex justify-center">
                    <span
                      className="rounded-full px-5 py-1.5 text-lg font-bold"
                      style={{ color: `var(--${statusTone})`, backgroundColor: `var(--${statusTone}-soft)`, fontFamily: "var(--font-serif)" }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-card-foreground">
                    La fiabilité de votre santé financière se révélera au fil des mois, à mesure que vous saisirez vos dépenses.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="inline-block h-2 w-6 rounded-full" style={{ backgroundColor: i < 3 ? "var(--primary)" : "var(--border)" }} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">3 indicateurs sur 5 calculés, à partir de vos données déclarées</p>
                </div>

                {F + C > R && (
                  <div className="flex gap-2 rounded-xl p-3 text-xs font-medium" style={{ color: "var(--bad)", backgroundColor: "var(--bad-soft)" }}>
                    <TriangleAlert size={16} className="shrink-0" />
                    <p>Vos charges fixes et vos crédits dépassent votre revenu. Vérifiez vos montants.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {indicators.map((ind) => (
                    <div key={ind.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-card-foreground">{ind.label}</p>
                          <p className="text-xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-serif)" }}>
                            {ind.value}
                          </p>
                        </div>
                        <Pill tone={toneOf(ind.note)}>{ind.pill}</Pill>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{ind.msg}</p>
                    </div>
                  ))}
                  {[
                    { id: "pre", label: "Épargne de précaution" },
                    { id: "mar", label: "Marge disponible" },
                  ].map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
                      <Clock size={18} className="shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">{p.label}</p>
                        <p className="text-xs text-muted-foreground">Disponible après vos premières dépenses saisies.</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-2 text-sm font-semibold text-card-foreground">Ce que vous avez déclaré</p>
                  <ul className="space-y-1.5 text-sm">
                    {[
                      ["Revenu net mensuel", fmt(R)],
                      ["Charges fixes (par mois)", fmt(F)],
                      ["Mensualités de crédit", fmt(C)],
                      ["Épargne totale", fmt(savSolde)],
                      ["Versement mensuel d'épargne", fmt(V)],
                      ["Personnes à charge (vous inclus)", household === 10 ? "10 et plus" : String(household)],
                    ].map(([l, v]) => (
                      <li key={l} className="flex justify-between text-card-foreground">
                        <span className="text-muted-foreground">{l}</span>
                        <span className="font-semibold">{v}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 rounded-xl bg-secondary p-2 text-xs text-secondary-foreground">
                    Reste à vivre par personne : {fmt(Math.max(0, R - F - C) / household)} par mois (indicatif).
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-card-foreground">Recevoir ma situation de départ</p>
                  <p className="text-xs text-muted-foreground">Gardez une trace de votre résultat, et retrouvez-le à tout moment.</p>
                  {([
                    { on: chEmail, set: setChEmail, Icon: Mail, label: "Par e-mail", to: email },
                    { on: chSms, set: setChSms, Icon: MessageSquare, label: "Par SMS", to: fullPhone },
                  ]).map((ch) => (
                    <button key={ch.label} type="button" onClick={() => { ch.set(!ch.on); setSent(false); }} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${ch.on ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card text-card-foreground"}`}>
                      <ch.Icon size={18} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{ch.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{ch.to}</span>
                      </span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded border ${ch.on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{ch.on && <Check size={14} />}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setMonthly2(!monthly2)} className="flex items-center gap-2 text-left text-sm text-card-foreground">
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${monthly2 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{monthly2 && <Check size={14} />}</span>
                    Recevoir aussi mon bilan chaque mois
                  </button>
                  <button type="button" disabled={!chEmail && !chSms} onClick={() => setSent(true)} className={`w-full rounded-full px-4 py-2.5 text-sm font-bold ${chEmail || chSms ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    Envoyer ma situation
                  </button>
                  {sent && (
                    <div className="space-y-2 rounded-xl p-3 text-xs" style={{ color: "var(--good)", backgroundColor: "var(--good-soft)" }}>
                      <p className="font-bold">Envoyé {chEmail && chSms ? "par e-mail et par SMS" : chEmail ? "par e-mail" : "par SMS"}. Aperçu du message :</p>
                      <p className="font-medium">
                        Bonjour {first}, voici votre situation de départ : {statusLabel}. {indicators.map((ind) => `${ind.label} : ${ind.pill}`).join(" · ")}. Votre premier score complet sera prêt dans 30 jours. Estimation indicative, ne constitue pas un conseil financier.
                      </p>
                    </div>
                  )}
                </div>

                {started ? (
                  <div className="rounded-2xl p-4 text-sm font-medium" style={{ color: "var(--good)", backgroundColor: "var(--good-soft)" }}>
                    C'est parti. Saisissez vos dépenses chaque jour : votre premier score complet sera prêt dans 30 jours.
                  </div>
                ) : (
                  <button type="button" onClick={() => setStarted(true)} className="w-full rounded-full bg-accent px-4 py-3 text-sm font-bold text-accent-foreground">
                    Commencer à saisir mes dépenses
                  </button>
                )}
                <Hint>Estimation basée sur vos informations déclarées. Elle ne constitue pas un conseil financier.</Hint>
              </div>
            )}

            {/* footer nav */}
            <div className="flex gap-3 pt-1">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-card-foreground">
                  <ArrowLeft size={16} /> {isResult ? "Modifier" : "Retour"}
                </button>
              )}
              {!isResult && (
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => canNext && setStep(step + 1)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-bold ${canNext ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {step === 4 ? "Voir ma situation de départ" : "Continuer"} <ArrowRight size={16} />
                </button>
              )}
            </div>
            {step === 0 && !canNext && <p className="text-center text-xs text-muted-foreground">Saisissez votre revenu pour continuer.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </FrameRoot>
  );
}
