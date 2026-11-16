import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { weekdayShortDate, daysWord } from "@/domain/format/date";
import type {
  LeadershipDot,
  LeadershipDotColor,
} from "@/domain/workflow/leadershipStatus";
import type {
  HomeBox,
  HomeDayScript,
  HomeMonth,
  HomeScript,
  LeadershipHome,
} from "@/server/leadershipScripts";
import { TopBar } from "@/ui/TopBar";
import { cn, focusRing } from "@/ui/cn";

export const DOT_CLASS: Record<LeadershipDotColor, string> = {
  yellow: "bg-[#f2b705]",
  green: "bg-lime-dot",
  red: "bg-danger-text",
  grey: "bg-grey-dot",
};

function Dot({
  color,
  className,
}: {
  color: LeadershipDotColor;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full",
        DOT_CLASS[color],
        className,
      )}
    />
  );
}

const shootLine = (home: LeadershipHome) => {
  if (!home.shootDate)
    return `${home.monthTitle} · natáčecí den zatím není určen`;
  const n = home.daysToShoot;
  const tail =
    n === null
      ? ""
      : n > 0
        ? ` · za ${daysWord(n)}`
        : n === 0
          ? " · dnes"
          : " · už proběhlo";
  return `Natáčení ${weekdayShortDate(home.shootDate)}${tail}`;
};

const PILL_CLASS: Record<LeadershipDotColor, string> = {
  yellow: "bg-[#fff3c4] text-[#7a5b00]",
  green: "bg-[#e3f2c8] text-[#2f5d0a]",
  red: "bg-[#fde2e2] text-danger-text",
  grey: "bg-ink/[0.08] text-text2",
};
const pillLabel = (d: LeadershipDot) =>
  d.color === "red" ? "Vráceno" : d.color === "grey" ? "Admin píše" : d.label;

function StatusPill({ dot }: { dot: LeadershipDot }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        PILL_CLASS[dot.color],
      )}
    >
      {pillLabel(dot)}
    </span>
  );
}

function CategoryTag({
  label,
  color,
  textColor,
}: {
  label: string;
  color: string | null;
  textColor: string | null;
}) {
  return (
    <span
      className="inline-block rounded-pill px-2 py-0.5 text-xs font-semibold"
      style={{ background: color ?? "#ECEBF3", color: textColor ?? "#2a2840" }}
    >
      {label}
    </span>
  );
}

function ScriptRow({
  s,
  tag,
}: {
  s: HomeScript & Partial<HomeDayScript>;
  tag?: boolean;
}) {
  return (
    <li>
      <Link
        href={
          s.dot.target === "review"
            ? `/kontrola/${s.code}`
            : `/scenare/${s.code}`
        }
        className={cn("flex min-h-14 items-center gap-3 px-5 py-3", focusRing)}
      >
        <Dot color={s.dot.color} className="size-3" />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="font-semibold">
            {s.title}{" "}
            <span className="text-xs font-normal text-text2">{s.code}</span>
          </span>
          {tag && s.categoryLabel && (
            <CategoryTag
              label={s.categoryLabel}
              color={s.categoryColor ?? null}
              textColor={s.categoryTextColor ?? null}
            />
          )}
        </span>
        <StatusPill dot={s.dot} />
        <ChevronRight aria-hidden className="size-5 shrink-0 text-text2" />
      </Link>
    </li>
  );
}

function ScriptList({
  scripts,
  tag,
  id,
}: {
  scripts: (HomeScript & Partial<HomeDayScript>)[];
  tag?: boolean;
  id?: string;
}) {
  return (
    <ul id={id} className="flex flex-col divide-y divide-ink/10">
      {scripts.length === 0 && (
        <li className="p-5 text-text2">Zatím tu nejsou žádné scénáře.</li>
      )}
      {scripts.map((s) => (
        <ScriptRow key={s.id} s={s} tag={tag} />
      ))}
    </ul>
  );
}

function BoxHeader({
  box,
  chevron,
}: {
  box: HomeBox;
  chevron?: React.ReactNode;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 text-h2">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full"
            style={{ background: box.color ?? "#8a87a0" }}
          />
          {box.label}
        </span>
        <span className="font-semibold">
          {box.total} {box.total === 1 ? "scénář připraven" : box.total >= 2 && box.total <= 4 ? "scénáře připraveny" : "scénářů připraveno"} · {box.done} schváleno
        </span>
        {(box.toReview > 0 || box.returned > 0 || box.adminWriting > 0 || box.done > 0) && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text2">
            {box.toReview > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Dot color="yellow" className="size-2.5" />
                {box.toReview} ke kontrole
              </span>
            )}
            {box.returned > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Dot color="red" className="size-2.5" />
                {box.returned} vráceno
              </span>
            )}
            {box.adminWriting > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Dot color="grey" className="size-2.5" />
                {box.adminWriting} Admin píše
              </span>
            )}
            {box.done > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Dot color="green" className="size-2.5" />
                {box.done} schváleno
              </span>
            )}
          </span>
        )}
      </span>
      {chevron}
    </>
  );
}

/** Mobile accordion card. */
function BoxCard({
  box,
  open,
  href,
}: {
  box: HomeBox;
  open: boolean;
  href: string;
}) {
  const panel = `box-${box.key || "none"}`;
  return (
    <li
      className="overflow-hidden rounded-card bg-card"
      data-box={box.key || "none"}
    >
      <Link
        href={href}
        scroll={false}
        aria-expanded={open}
        aria-controls={panel}
        className={cn("flex min-h-24 items-center gap-3 p-5", focusRing)}
      >
        <BoxHeader
          box={box}
          chevron={
            <ChevronDown
              aria-hidden
              className={cn(
                "size-6 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          }
        />
      </Link>
      {open && (
        <div className="border-t border-ink/10">
          <ScriptList scripts={box.scripts} id={panel} />
        </div>
      )}
    </li>
  );
}

/** Desktop master: summary only, the selected one highlighted. */
function MasterBox({
  box,
  selected,
  href,
}: {
  box: HomeBox;
  selected: boolean;
  href: string;
}) {
  return (
    <li data-master={box.key || "none"}>
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-h-24 items-center gap-3 rounded-card border-2 bg-card p-5",
          selected ? "border-ink" : "border-transparent",
          focusRing,
        )}
      >
        <BoxHeader box={box} />
      </Link>
    </li>
  );
}

const scriptsWord = (n: number) =>
  `${n} ${n === 1 ? "scénář" : n >= 2 && n <= 4 ? "scénáře" : "scénářů"}`;
const shootText = (shootDate: string, n: number | null) =>
  `natáčení ${weekdayShortDate(shootDate)}${n === null ? "" : n > 0 ? ` · za ${daysWord(n)}` : n === 0 ? " · dnes" : " · proběhlo"}`;

function MonthSection({ m }: { m: HomeMonth }) {
  return (
    <section className="flex flex-col gap-2" data-month={m.month ?? "none"}>
      <div className="flex flex-col px-1">
        <h2 className="text-h2">{m.month ? m.label : "Bez měsíce"}</h2>
        <p className="text-sm text-text2">
          {m.month
            ? (m.shootDate
                ? shootText(m.shootDate, m.daysToShoot)
                : "natáčecí den zatím není určen") + " · "
            : ""}
          {scriptsWord(m.total)}
          {m.toReview > 0 ? ` · ${m.toReview} ke kontrole` : ""}
        </p>
      </div>
      <div className="overflow-hidden rounded-card bg-card">
        <ScriptList scripts={m.scripts} tag />
      </div>
    </section>
  );
}

function MonthsView({ months }: { months: HomeMonth[] }) {
  const firstPast = months.findIndex((d) => d.past);
  if (months.length === 0)
    return <p className="text-text2">Zatím tu nejsou žádné scénáře.</p>;
  return (
    <div className="flex flex-col gap-6">
      {months.map((m, i) => (
        <div key={m.month ?? "none"} className="flex flex-col gap-6">
          {i === firstPast && (
            <h2 className="text-sm font-semibold tracking-wide text-text2 uppercase">
              Starší měsíce
            </h2>
          )}
          <MonthSection m={m} />
        </div>
      ))}
    </div>
  );
}

export function LeadershipHomeView({
  home,
  name,
  openKey,
  basePath = "/",
}: {
  home: LeadershipHome;
  name: string;
  openKey: string | null;
  basePath?: string;
}) {
  const qs = (key: string | null) => {
    const p = new URLSearchParams();
    if (home.all) p.set("zobrazit", "vse");
    if (key !== null) p.set("kategorie", key || "none");
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const selKey =
    openKey ??
    (home.boxes.find((b) => b.toReview > 0) ?? home.boxes[0])?.key ??
    null;
  const selected =
    home.boxes.find((b) => (b.key || "none") === (selKey || "none")) ??
    home.boxes[0];
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 flex-1 items-center justify-center rounded-pill px-4 font-semibold",
        focusRing,
        active ? "bg-ink text-card" : "text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <TopBar
        title={`Ahoj ${name}`}
        subtitle={shootLine(home)}
        size="display"
        hidePeriod
      />
      <div className="flex w-full flex-col gap-4 md:gap-6 lg:max-w-[1200px]">
        <nav
          aria-label="Zobrazení"
          className="flex gap-1 rounded-pill bg-ink/[0.06] p-1 lg:max-w-md"
        >
          {tab(basePath, home.monthName, !home.all)}
          {tab(`${basePath}?zobrazit=vse`, "Všechny", home.all)}
        </nav>
        {home.all ? (
          <MonthsView months={home.months} />
        ) : (
          <>
            <ul className="flex flex-col gap-3 lg:hidden">
              {home.boxes.map((box) => {
                const open = openKey === (box.key || "none");
                return (
                  <BoxCard
                    key={box.key || "none"}
                    box={box}
                    open={open}
                    href={qs(open ? null : box.key)}
                  />
                );
              })}
            </ul>
            <div className="hidden items-start gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <ul className="flex flex-col gap-3">
                {home.boxes.map((box) => (
                  <MasterBox
                    key={box.key || "none"}
                    box={box}
                    selected={box === selected}
                    href={qs(box.key)}
                  />
                ))}
              </ul>
              {selected && (
                <section
                  aria-label={`Scénáře: ${selected.label}`}
                  data-detail={selected.key || "none"}
                  className="overflow-hidden rounded-card bg-card"
                >
                  <ScriptList scripts={selected.scripts} />
                </section>
              )}
            </div>
          </>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text2">
          <span className="inline-flex items-center gap-1.5">
            <Dot color="yellow" className="size-2.5" /> žlutá = čeká na tvou
            kontrolu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Dot color="green" className="size-2.5" /> zelená = zkontrolováno
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Dot color="red" className="size-2.5" /> červená = vráceno Adminovi
          </span>
        </p>
      </div>
    </div>
  );
}
