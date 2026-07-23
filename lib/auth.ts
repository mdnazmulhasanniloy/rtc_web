import { User } from "./types";
export function saveSession(token:string,user:User){localStorage.setItem("relay_token",token);localStorage.setItem("relay_user",JSON.stringify(user));}
export function currentUser():User|null{try{return JSON.parse(localStorage.getItem("relay_user")||"null")}catch{return null}}
export function logout(){localStorage.removeItem("relay_token");localStorage.removeItem("relay_user");location.href="/login"}
