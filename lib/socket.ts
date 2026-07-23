import { io, Socket } from "socket.io-client";
let socket: Socket | null = null;
export const getSocket = () => {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
  if (!socket) socket = io(apiUrl, { autoConnect: false, auth: cb => cb({ token: localStorage.getItem("relay_token") }), transports:["websocket","polling"] });
  return socket;
};
export const closeSocket = () => { socket?.disconnect(); socket = null; };
