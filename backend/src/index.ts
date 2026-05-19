import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import ShortUniqueId from "short-unique-id";

interface PlayerObj {
  id: string;
  nickName?: string;
  position: "white" | "black";
}

interface RoomObj {
  id: string;
  player?: PlayerObj;
  opponent?: PlayerObj;
  watchers?: PlayerObj[];
}

try {
  const app = express();
  app.use(cors());
  const server = http.createServer(app);

  const port = process.env.PORT || 8080;
  const frontendUrl = process.env.FRONTEND_URL;
  console.log({ frontendUrl });

  const origin = frontendUrl || "http://localhost:5173";
  const io = new Server(server, {
    cors: {
      origin: origin,
      methods: ["GET", "POST"],
      allowedHeaders: ["custom-header"],
      credentials: true,
    },
  });

  app.get("/chess-game/hello", (req, res) => {
    console.log({ req, res });
    res.send("Hello word Expres!!");
  });

  // TODO: Use a proper DB
  const rooms: Map<string, RoomObj> = new Map();

  // io.connection;
  io.on("connection", (socket) => {
    // socket refers to the client socket that just got connected.
    // each socket is assigned an id
    console.info({ [socket.id]: "connected" });

    socket.on("username", (username) => {
      console.info({ [socket.id]: `username ${username}` });
      socket.data.username = username;
    });

    // createRoom
    socket.on("createRoom", async (args, callback) => {
      // callback here refers to the callback function from the client passed as data
      console.log({ args });
      const roomId = new ShortUniqueId({ length: 12 }).randomUUID();
      console.info({ [socket.id]: `createRoom id ${roomId}` });
      await socket.join(roomId);

      // set roomId as a key and roomData including players as value in the map
      rooms.set(roomId, {
        id: roomId,
        player: {
          id: args.id,
          nickName: args.nickName,
          position: args.position,
        },
      });
      // returns Map(1){'2b5b51a9-707b-42d6-9da8-dc19f863c0d0' => [{id: 'socketid', username: 'username1'}]}

      callback(roomId);
    });

    socket.on("joinRoom", async (args, callback) => {
      // check if room exists and has a player waiting
      const room = rooms.get(args.roomId);
      console.info({ [socket.id]: `joinRoom id ${args.roomId}` });

      let error, message;

      if (!room) {
        error = true;
        message = "room does not exist";
      } else if (!room.player) {
        error = true;
        message = "room is empty";
      } else if (room.player && room.opponent) {
        error = true;
        message = "room is full"; // set message to 'room is full'
      }

      if (error) {
        if (callback) callback({ error, message });
        return; // exit
      }

      await socket.join(args.roomId); // make the joining client join the room

      // add the joining user's data to the list of players in the room
      const roomUpdate = {
        ...room,
        opponent: {
          id: args.id as string,
          nickName: args.nickName as string,
          position: room?.player?.position === "white" ? "black" : "white",
        },
      } as RoomObj;

      rooms.set(args.roomId, roomUpdate);

      callback(roomUpdate); // respond to the client with the room details.

      // emit an 'opponentJoined' event to the room to tell the other player that an opponent has joined
      socket.to(args.roomId).emit("opponentJoined", roomUpdate);
    });

    socket.on("move", (data) => {
      // emit to all sockets in the room except the emitting socket.
      console.info({ [socket.id]: `move`, data });
      socket.to(data.room).emit("move", data.move);
    });

    socket.on("disconnect", () => {
      console.info({ [socket.id]: `disconnect` });
      const gameRooms = Array.from(rooms.values());
      gameRooms.forEach((room) => {
        const userInRoom = room.players.find(
          (player) => player.id === socket.id,
        );

        if (userInRoom) {
          if (room.players.length < 2) {
            // if there's only 1 player in the room, close it and exit.
            rooms.delete(room.id);
            return;
          }

          socket.to(room.id).emit("playerDisconnected", userInRoom); // <- 4
        }
      });
    });

    socket.on("closeRoom", async (data) => {
      console.info({ [socket.id]: `closeRoom` });
      socket.to(data.roomId).emit("closeRoom", data); // <- 1 inform others in the room that the room is closing

      const clientSockets = await io.in(data.roomId).fetchSockets(); // <- 2 get all sockets in a room

      // loop over each socket client
      clientSockets.forEach((s) => {
        s.leave(data.roomId); // <- 3 and make them leave the room on socket.io
      });

      rooms.delete(data.roomId); // <- 4 delete room from rooms map
    });
  });

  server.listen(port, () => {
    console.log(`listening on *:${port}`);
  });
} catch (err) {
  console.error(err);
}
