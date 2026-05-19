import { io } from "socket.io-client"; // import connection function
import { backendUrl } from "./utils/config.default";

const socket = io(backendUrl, {
  withCredentials: true,
  extraHeaders: {
    "custom-header": "test",
  },
});

export default socket;
