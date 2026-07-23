import { cn } from "@/lib/utils";
export function Avatar({ name, status, size = "md" }: { name: string; status?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const colors = ["from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-300", "from-amber-400 to-rose-400", "from-emerald-400 to-lime-300"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return <div className="relative shrink-0"><div className={cn("grid place-items-center rounded-[35%] bg-gradient-to-br font-bold text-white shadow-inner", color, size === "sm" && "h-9 w-9 text-xs", size === "md" && "h-11 w-11 text-sm", size === "lg" && "h-14 w-14 text-base", size === "xl" && "h-24 w-24 text-2xl")}>{name.split(" ").map(x => x[0]).join("").slice(0,2)}</div>{status && <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-panel", status === "online" ? "bg-lime" : status === "away" ? "bg-amber-400" : "bg-slate-500")} />}</div>;
}
