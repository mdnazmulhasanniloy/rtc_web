import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);
const origin = process.env.WEB_ORIGIN || "http://localhost:3000";
const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production");
}
const secret = configuredSecret || "development-secret-change-me";
const corsOrigin = process.env.NODE_ENV === "production" ? origin.split(",") : true;
const io = new Server(server, { cors: { origin: corsOrigin, credentials: true }, transports: ["websocket", "polling"] });
const uploadDir = process.env.UPLOAD_DIR || path.resolve("uploads");
mkdirSync(uploadDir, { recursive: true });
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use("/uploads", express.static(uploadDir, { immutable: true, maxAge: "30d", index: false }));
app.use(express.json({ limit: "3mb" }));

type Authed = Request & { userId?: string };
const auth = (req: Authed, res: Response, next: NextFunction) => { try { const token = req.headers.authorization?.replace("Bearer ", ""); if (!token) return res.status(401).json({ error: "Authentication required" }); req.userId = (jwt.verify(token, secret) as { sub: string }).sub; next(); } catch { return res.status(401).json({ error: "Invalid or expired session" }); } };
const registerSchema = z.object({ name:z.string().min(2).max(60), username:z.string().min(3).max(24).regex(/^[a-z0-9_]+$/), email:z.string().email(), password:z.string().min(8).max(72) });
app.get("/health", (_req,res) => res.json({ status:"ok" }));
app.get("/auth/me",auth,async(req:Authed,res,next)=>{try{const user=await prisma.user.findUnique({where:{id:req.userId},select:{id:true,name:true,email:true,username:true,avatar:true,bio:true}});if(!user)return res.status(404).json({error:"User not found"});res.json(user)}catch(e){next(e)}});
app.patch("/auth/me",auth,async(req:Authed,res,next)=>{try{const data=z.object({name:z.string().trim().min(2).max(60),bio:z.string().trim().max(160),avatarData:z.string().max(2_800_000).optional()}).parse(req.body);let avatar:string|undefined;if(data.avatarData){const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data.avatarData);if(!match)return res.status(400).json({error:"Invalid profile image"});const buffer=Buffer.from(match[2],"base64");if(buffer.length>2_000_000)return res.status(400).json({error:"Profile image must be smaller than 2 MB"});const extension=match[1]==="jpeg"?"jpg":match[1];const filename=`${req.userId}-${randomUUID()}.${extension}`;await writeFile(path.join(uploadDir,filename),buffer,{flag:"wx"});avatar=`/uploads/${filename}`}const user=await prisma.user.update({where:{id:req.userId},data:{name:data.name,bio:data.bio,avatar},select:{id:true,name:true,email:true,username:true,avatar:true,bio:true}});res.json(user)}catch(e){next(e)}});
app.get("/turn-credentials",auth,(req:Authed,res)=>{const host=process.env.TURN_HOST,sharedSecret=process.env.TURN_SHARED_SECRET;if(!host||!sharedSecret)return res.status(503).json({error:"TURN server is not configured"});const expires=Math.floor(Date.now()/1000)+86400;const username=`${expires}:${req.userId}`;const credential=createHmac("sha1",sharedSecret).update(username).digest("base64");res.json({iceServers:[{urls:`stun:${host}:3478`},{urls:[`turn:${host}:3478?transport=udp`,`turn:${host}:3478?transport=tcp`],username,credential}]})});
app.post("/auth/register", async (req,res,next) => { try { const data=registerSchema.parse(req.body); const email=data.email.toLowerCase(); const username=data.username.toLowerCase(); const exists=await prisma.user.findFirst({where:{OR:[{email},{username}]}}); if(exists) return res.status(409).json({error:"Email or username already exists"}); const passwordHash=await bcrypt.hash(data.password,12); const user=await prisma.user.create({data:{name:data.name,email,username,passwordHash},select:{id:true,name:true,email:true,username:true,avatar:true,bio:true}}); const token=jwt.sign({},secret,{subject:user.id,expiresIn:"7d"}); res.status(201).json({user,token}); } catch(e){next(e)} });
app.post("/auth/login", async(req,res,next)=>{try{const {email,password}=z.object({email:z.string().email(),password:z.string()}).parse(req.body);const user=await prisma.user.findUnique({where:{email:email.toLowerCase()}});if(!user||!await bcrypt.compare(password,user.passwordHash))return res.status(401).json({error:"Incorrect email or password"});const token=jwt.sign({},secret,{subject:user.id,expiresIn:"7d"});res.json({token,user:{id:user.id,name:user.name,username:user.username,email:user.email,avatar:user.avatar}})}catch(e){next(e)}});
app.get("/users",auth,async(req:Authed,res,next)=>{try{const q=String(req.query.q||"").slice(0,50);const users=await prisma.user.findMany({where:{id:{not:req.userId},OR:q?[{name:{contains:q}},{username:{contains:q}}]:undefined},select:{id:true,name:true,username:true,avatar:true,bio:true},take:30,orderBy:{name:"asc"}});res.json(users)}catch(e){next(e)}});
app.get("/conversations",auth,async(req:Authed,res,next)=>{try{const rows=await prisma.conversation.findMany({where:{members:{some:{userId:req.userId}}},include:{members:{include:{user:{select:{id:true,name:true,username:true,avatar:true,bio:true}}}},messages:{orderBy:{createdAt:"desc"},take:1}},orderBy:{updatedAt:"desc"},take:50});res.json(rows)}catch(e){next(e)}});
app.post("/conversations",auth,async(req:Authed,res,next)=>{try{const {userId}=z.object({userId:z.string()}).parse(req.body);if(userId===req.userId)return res.status(400).json({error:"Cannot message yourself"});const include={members:{include:{user:{select:{id:true,name:true,username:true,avatar:true,bio:true}}}},messages:{orderBy:{createdAt:"desc"}as const,take:1}};const existing=await prisma.conversation.findFirst({where:{AND:[{members:{some:{userId:req.userId}}},{members:{some:{userId}}},{members:{every:{userId:{in:[req.userId!,userId]}}}}]},include});if(existing)return res.json(existing);const conversation=await prisma.conversation.create({data:{members:{create:[{userId:req.userId!},{userId}]}},include});io.in(`user:${req.userId}`).socketsJoin(`conversation:${conversation.id}`);io.in(`user:${userId}`).socketsJoin(`conversation:${conversation.id}`);io.to(`user:${userId}`).emit("conversation:new",conversation);res.status(201).json(conversation)}catch(e){next(e)}});
app.get("/conversations/:id/messages",auth,async(req:Authed,res,next)=>{try{const conversationId=String(req.params.id);const member=await prisma.conversationMember.findUnique({where:{userId_conversationId:{userId:req.userId!,conversationId}}});if(!member)return res.status(403).json({error:"Not a member"});const cursor=typeof req.query.cursor==="string"?req.query.cursor:undefined;const messages=await prisma.message.findMany({where:{conversationId},orderBy:{createdAt:"desc"},take:50,...(cursor?{cursor:{id:cursor},skip:1}:{})});res.json(messages.reverse())}catch(e){next(e)}});
app.get("/calls",auth,async(req:Authed,res,next)=>{try{res.json(await prisma.call.findMany({where:{OR:[{callerId:req.userId},{calleeId:req.userId}]},include:{caller:{select:{id:true,name:true,avatar:true}},callee:{select:{id:true,name:true,avatar:true}}},orderBy:{startedAt:"desc"},take:50}))}catch(e){next(e)}});
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(err instanceof z.ZodError)return res.status(400).json({error:"Invalid request",details:err.flatten()});console.error(err);res.status(500).json({error:"Something went wrong"})});

const online = new Map<string, Set<string>>();
io.use((socket,next)=>{try{const token=socket.handshake.auth.token;if(!token)return next(new Error("Unauthorized"));socket.data.userId=(jwt.verify(token,secret)as{sub:string}).sub;next()}catch{next(new Error("Unauthorized"))}});
io.on("connection",async socket=>{const userId=socket.data.userId as string;const ids=online.get(userId)||new Set();ids.add(socket.id);online.set(userId,ids);socket.emit("presence:list",Array.from(online.keys()));socket.broadcast.emit("presence:update",{userId,status:"online"});const memberships=await prisma.conversationMember.findMany({where:{userId},select:{conversationId:true}});memberships.forEach((m:{conversationId:string})=>socket.join(`conversation:${m.conversationId}`));
  socket.on("message:send",async(payload,ack)=>{try{const data=z.object({conversationId:z.string(),body:z.string().min(1).max(5000),clientId:z.string().optional()}).parse(payload);const member=await prisma.conversationMember.findUnique({where:{userId_conversationId:{userId,conversationId:data.conversationId}}});if(!member)throw new Error("Forbidden");const message=await prisma.message.create({data:{body:data.body,senderId:userId,conversationId:data.conversationId},include:{sender:{select:{id:true,name:true,avatar:true}}}});io.to(`conversation:${data.conversationId}`).emit("message:new",{...message,clientId:data.clientId});ack?.({ok:true,id:message.id})}catch(e){ack?.({ok:false,error:e instanceof Error?e.message:"Failed"})}});
  socket.on("typing:start",({conversationId})=>socket.to(`conversation:${conversationId}`).emit("typing:update",{conversationId,userId,typing:true}));socket.on("typing:stop",({conversationId})=>socket.to(`conversation:${conversationId}`).emit("typing:update",{conversationId,userId,typing:false}));
  socket.on("message:read",async({conversationId})=>{await prisma.conversationMember.update({where:{userId_conversationId:{userId,conversationId}},data:{lastReadAt:new Date()}}).catch(()=>{});socket.to(`conversation:${conversationId}`).emit("message:read",{conversationId,userId,at:new Date()})});
  socket.on("call:offer",async({targetUserId,conversationId,mode,offer},ack)=>{try{const caller=await prisma.user.findUnique({where:{id:userId},select:{id:true,name:true,username:true,avatar:true,bio:true}});const call=await prisma.call.create({data:{type:mode==="video"?"VIDEO":"AUDIO",status:"CANCELLED",callerId:userId,calleeId:targetUserId,conversationId}});io.to(`user:${targetUserId}`).emit("call:offer",{fromUserId:userId,caller,conversationId,mode,offer,callId:call.id});ack?.({ok:true,callId:call.id})}catch{ack?.({ok:false})}});
  socket.on("call:answer",({targetUserId,...data})=>io.to(`user:${targetUserId}`).emit("call:answer",{...data,fromUserId:userId}));
  socket.on("call:ice-candidate",({targetUserId,...data})=>io.to(`user:${targetUserId}`).emit("call:ice-candidate",{...data,fromUserId:userId}));
  socket.on("call:end",async({targetUserId,callId,status="COMPLETED",duration=0})=>{io.to(`user:${targetUserId}`).emit("call:end",{fromUserId:userId,callId});if(callId)await prisma.call.update({where:{id:callId},data:{status,endedAt:new Date(),duration}}).catch(()=>{})});socket.join(`user:${userId}`);
  socket.on("disconnect",()=>{const current=online.get(userId);current?.delete(socket.id);if(!current?.size){online.delete(userId);socket.broadcast.emit("presence:update",{userId,status:"offline"})}})
});
const port=Number(process.env.PORT||4000);server.listen(port,"0.0.0.0",()=>console.log(`Relay API listening on http://0.0.0.0:${port}`));
process.on("SIGTERM",async()=>{await prisma.$disconnect();server.close()});
