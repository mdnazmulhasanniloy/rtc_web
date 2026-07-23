export type User = { id: string; name: string; username: string; email?: string; avatar?: string | null; bio?: string | null; status?: "online" | "offline" };
export type Message = { id: string; body: string; senderId: string; conversationId: string; createdAt: string; clientId?: string };
export type Conversation = { id: string; members: { userId: string; user: User }[]; messages: Message[]; updatedAt: string };
export type CallRecord = { id: string; type: "AUDIO"|"VIDEO"; status: "MISSED"|"DECLINED"|"COMPLETED"|"CANCELLED"; startedAt:string; duration:number; caller:User; callee:User };
export type IncomingCall = { fromUserId:string; caller:User; conversationId:string; mode:"audio"|"video"; offer:RTCSessionDescriptionInit; callId:string };
