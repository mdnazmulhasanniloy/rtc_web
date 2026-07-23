"use client";
import { ChangeEvent, FormEvent, useState } from "react";
import { Camera, Loader2, Save, X } from "lucide-react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { Avatar } from "./avatar";

async function prepareImage(file:File){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose a JPG, PNG or WebP image.");
 if(file.size>8*1024*1024)throw new Error("Image must be smaller than 8 MB.");
 const source=await createImageBitmap(file),max=512,scale=Math.min(1,max/Math.max(source.width,source.height));
 const canvas=document.createElement("canvas");canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);
 canvas.getContext("2d")?.drawImage(source,0,0,canvas.width,canvas.height);source.close();
 return canvas.toDataURL("image/webp",.82);
}

export function ProfileModal({user,onClose,onSaved}:{user:User;onClose:()=>void;onSaved:(user:User)=>void}){
 const [name,setName]=useState(user.name),[bio,setBio]=useState(user.bio||""),[avatarData,setAvatarData]=useState(""),[preview,setPreview]=useState(user.avatar||""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 async function choose(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;try{const data=await prepareImage(file);setAvatarData(data);setPreview(data)}catch(err){setError(err instanceof Error?err.message:"Could not read image")}}
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const updated=await api<User>("/auth/me",{method:"PATCH",body:JSON.stringify({name,bio,avatarData:avatarData||undefined})});onSaved(updated);onClose()}catch(err){setError(err instanceof Error?err.message:"Could not update profile")}finally{setSaving(false)}}
 return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <form onSubmit={submit} className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#121824] p-6 shadow-2xl md:p-8">
   <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-lime">Your identity</p><h2 id="profile-title" className="mt-1 text-2xl font-bold">Edit profile</h2></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:bg-white/10" aria-label="Close profile editor"><X size={20}/></button></div>
   <div className="mt-7 flex items-center gap-5"><Avatar name={name||user.name} avatar={preview} size="xl"/><div><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 focus-within:ring-2 focus-within:ring-lime"><Camera size={17}/>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} className="sr-only"/></label><p className="mt-2 text-xs text-slate-500">JPG, PNG or WebP · max 8 MB</p></div></div>
   <div className="mt-7 space-y-5"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">Display name</span><input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-white/[.04] px-4 outline-none transition focus:border-lime/60 focus:ring-2 focus:ring-lime/10"/></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">Bio</span><textarea maxLength={160} rows={3} value={bio} onChange={e=>setBio(e.target.value)} className="w-full resize-none rounded-xl border border-line bg-white/[.04] px-4 py-3 outline-none transition focus:border-lime/60 focus:ring-2 focus:ring-lime/10" placeholder="Tell people a little about you"/><span className="mt-1 block text-right text-xs text-slate-600">{bio.length}/160</span></label></div>
   {error&&<p className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
   <button disabled={saving} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime font-bold text-ink transition hover:bg-[#d4ff7b] disabled:cursor-not-allowed disabled:opacity-60">{saving?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>}Save changes</button>
  </form>
 </div>
}
