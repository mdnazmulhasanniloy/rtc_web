const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😢","😭","😡","👍","👎","👏","🙌","🙏","💪","❤️","💜","🔥","✨","🎉","💯","✅","👀","😊","😉","🤗","😴","🤝","🚀","🌟"];

export function EmojiPicker({onPick,onClose}:{onPick:(emoji:string)=>void;onClose:()=>void}) {
 return <div className="absolute bottom-[72px] left-0 z-30 w-[280px] rounded-2xl border border-white/10 bg-[#151b29]/98 p-3 shadow-2xl backdrop-blur-xl" role="dialog" aria-label="Choose an emoji">
  <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold text-slate-300">Emoji</p><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/10 hover:text-white">Close</button></div>
  <div className="grid grid-cols-6 gap-1">{EMOJIS.map(emoji=><button type="button" key={emoji} onClick={()=>onPick(emoji)} className="grid h-10 w-10 place-items-center rounded-xl text-xl transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-lime" aria-label={`Insert ${emoji}`}>{emoji}</button>)}</div>
 </div>
}
