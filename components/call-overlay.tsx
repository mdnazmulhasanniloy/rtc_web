"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, MonitorUp, PhoneOff, ScreenShareOff, Video, VideoOff, Volume2 } from "lucide-react";
import { Socket } from "socket.io-client";
import { IncomingCall, User } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "./avatar";

type Props={person:User;mode:"audio"|"video";conversationId:string;socket:Socket;incoming?:IncomingCall;onClose:()=>void};

function waitForIceGathering(pc:RTCPeerConnection,timeoutMs=2000){
 if(pc.iceGatheringState==="complete")return Promise.resolve();
 return new Promise<void>(resolve=>{
  const done=()=>{clearTimeout(timeout);pc.removeEventListener("icegatheringstatechange",changed);resolve()};
  const changed=()=>{if(pc.iceGatheringState==="complete")done()};
  const timeout=setTimeout(done,timeoutMs);
  pc.addEventListener("icegatheringstatechange",changed);
 });
}

export function CallOverlay({person,mode,conversationId,socket,incoming,onClose}:Props){
 const [muted,setMuted]=useState(false),[camera,setCamera]=useState(mode==="video"),[sharing,setSharing]=useState(false),[seconds,setSeconds]=useState(0),[state,setState]=useState("Connecting securely…"),[error,setError]=useState("");
 const localVideo=useRef<HTMLVideoElement>(null),remoteVideo=useRef<HTMLVideoElement>(null),remoteAudio=useRef<HTMLAudioElement>(null),local=useRef<MediaStream|null>(null),display=useRef<MediaStream|null>(null),peer=useRef<RTCPeerConnection|null>(null),callId=useRef(incoming?.callId);
 const end=useCallback((notify=true)=>{if(notify)socket.emit("call:end",{targetUserId:person.id,callId:callId.current,status:state==="Connected"?"COMPLETED":"CANCELLED",duration:seconds});display.current?.getTracks().forEach(t=>t.stop());peer.current?.close();local.current?.getTracks().forEach(t=>t.stop());onClose()},[onClose,person.id,seconds,socket,state]);

 useEffect(()=>{let mounted=true;const candidates:RTCIceCandidateInit[]=[];
  async function start(){try{
   const mediaPromise=navigator.mediaDevices.getUserMedia({audio:true,video:mode==="video"});
   const icePromise=api<{iceServers:RTCIceServer[]}>("/turn-credentials").then(r=>r.iceServers).catch(()=>{setError("TURN credentials are unavailable. Calls may fail on restricted networks.");return [] as RTCIceServer[]});
   const [stream,iceServers]=await Promise.all([mediaPromise,icePromise]);
   if(!mounted){stream.getTracks().forEach(t=>t.stop());return}
   local.current=stream;if(localVideo.current)localVideo.current.srcObject=stream;
   const pc=new RTCPeerConnection({iceServers});peer.current=pc;stream.getTracks().forEach(t=>pc.addTrack(t,stream));
   pc.ontrack=e=>{const remoteStream=e.streams[0]||new MediaStream([e.track]);if(remoteVideo.current)remoteVideo.current.srcObject=remoteStream;if(remoteAudio.current)remoteAudio.current.srcObject=remoteStream;setState("Connected");setError("")};
   pc.onicecandidate=e=>{if(e.candidate&&pc.remoteDescription)socket.emit("call:ice-candidate",{targetUserId:person.id,candidate:e.candidate.toJSON()})};
   pc.onconnectionstatechange=()=>{if(pc.connectionState==="connected")setState("Connected");if(["failed","disconnected"].includes(pc.connectionState)){setState("Connection lost");setError("The media connection could not reach the TURN server.")}};
   if(incoming){await pc.setRemoteDescription(incoming.offer);for(const c of candidates.splice(0))await pc.addIceCandidate(c);await pc.setLocalDescription(await pc.createAnswer());await waitForIceGathering(pc);socket.emit("call:answer",{targetUserId:person.id,answer:pc.localDescription,callId:incoming.callId})}
   else{await pc.setLocalDescription(await pc.createOffer());await waitForIceGathering(pc);socket.emit("call:offer",{targetUserId:person.id,conversationId,mode,offer:pc.localDescription},(r:{ok:boolean;callId?:string})=>{if(r.callId)callId.current=r.callId;else if(!r.ok)setError("The call could not be delivered.")})}
  }catch(e){setError(e instanceof DOMException&&e.name==="NotAllowedError"?"Camera or microphone permission was denied.":e instanceof DOMException&&e.name==="NotFoundError"?"No camera or microphone was found.":"Could not start this call.")}}
  void start();
  const answer=async({fromUserId,answer}:{fromUserId:string;answer:RTCSessionDescriptionInit})=>{if(fromUserId===person.id&&peer.current){await peer.current.setRemoteDescription(answer);for(const c of candidates)await peer.current.addIceCandidate(c)}};
  const ice=async({fromUserId,candidate}:{fromUserId:string;candidate:RTCIceCandidateInit})=>{if(fromUserId!==person.id)return;if(peer.current?.remoteDescription)await peer.current.addIceCandidate(candidate);else candidates.push(candidate)};
  const ended=({fromUserId}:{fromUserId:string})=>{if(fromUserId===person.id)end(false)};
  socket.on("call:answer",answer);socket.on("call:ice-candidate",ice);socket.on("call:end",ended);
  return()=>{mounted=false;socket.off("call:answer",answer);socket.off("call:ice-candidate",ice);socket.off("call:end",ended);display.current?.getTracks().forEach(t=>t.stop());peer.current?.close();local.current?.getTracks().forEach(t=>t.stop())};
 },[]);

 useEffect(()=>{if(state!=="Connected")return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id)},[state]);
 const toggleMute=()=>{local.current?.getAudioTracks().forEach(t=>t.enabled=muted);setMuted(!muted)};
 const toggleCamera=()=>{local.current?.getVideoTracks().forEach(t=>t.enabled=!camera);setCamera(!camera)};
 const stopSharing=useCallback(async()=>{const sender=peer.current?.getSenders().find(s=>s.track?.kind==="video");await sender?.replaceTrack(local.current?.getVideoTracks()[0]||null);display.current?.getTracks().forEach(t=>{t.onended=null;t.stop()});display.current=null;if(localVideo.current)localVideo.current.srcObject=local.current;setSharing(false)},[]);
 async function toggleSharing(){if(sharing){await stopSharing();return}try{const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:30}},audio:false});const track=stream.getVideoTracks()[0],sender=peer.current?.getSenders().find(s=>s.track?.kind==="video");if(!sender){stream.getTracks().forEach(t=>t.stop());setError("Screen sharing is available during video calls.");return}await sender.replaceTrack(track);display.current=stream;if(localVideo.current)localVideo.current.srcObject=stream;track.onended=()=>{void stopSharing()};setSharing(true);setError("")}catch(e){if(!(e instanceof DOMException&&e.name==="NotAllowedError"))setError("Could not start screen sharing.")}}

 return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label={`${mode} call with ${person.name}`}><div className="flex h-[min(760px,94vh)] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#111522] shadow-2xl"><div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#252b40,#0d1019_70%)]">
 {mode==="video"?<><video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover"/><video ref={localVideo} autoPlay muted playsInline className="absolute bottom-5 right-5 h-32 w-44 rounded-2xl border border-white/10 bg-panel object-cover shadow-soft"/></>:<><audio ref={remoteAudio} autoPlay/><div className="text-center"><div className="mx-auto w-fit"><Avatar name={person.name} avatar={person.avatar} size="xl" status="online"/></div><h2 className="mt-6 text-2xl font-bold">{person.name}</h2><p className="mt-2 text-sm text-slate-400">{state==="Connected"?`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`:state}</p></div></>}
 {sharing&&<div className="absolute left-5 top-5 rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-ink">You are sharing your screen</div>}{error&&<div className="absolute bottom-8 max-w-md rounded-xl bg-rose-500/20 px-4 py-3 text-center text-sm text-rose-200">{error}</div>}</div>
 <div className="flex items-center justify-center gap-3 border-t border-white/10 p-5"><Control onClick={toggleMute} label={muted?"Unmute":"Mute"} active={muted}>{muted?<MicOff/>:<Mic/>}</Control><Control onClick={toggleCamera} label={camera?"Turn camera off":"Turn camera on"} active={!camera}>{camera?<Video/>:<VideoOff/>}</Control>{mode==="video"&&<Control onClick={toggleSharing} label={sharing?"Stop sharing":"Share screen"} active={sharing}>{sharing?<ScreenShareOff/>:<MonitorUp/>}</Control>}<Control label="Speaker"><Volume2/></Control><button onClick={()=>end()} className="grid h-12 w-16 place-items-center rounded-full bg-rose-500 transition hover:bg-rose-400 focus-visible:ring-2 focus-visible:ring-white" aria-label="End call"><PhoneOff/></button></div></div></div>
}
function Control({children,label,onClick,active=false}:{children:React.ReactNode;label:string;onClick?:()=>void;active?:boolean}){return <button onClick={onClick} className={`grid h-12 w-12 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:ring-lime ${active?"bg-lime text-ink":"bg-white/10 hover:bg-white/15"}`} aria-label={label} aria-pressed={active}>{children}</button>}
