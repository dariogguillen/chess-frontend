import { io } from "socket.io-client";
import { backendUrl } from "./config.default";

const socket = io(backendUrl, {
  withCredentials: true,
  extraHeaders: {
    "custom-header": "test",
  },
});

export default socket;
