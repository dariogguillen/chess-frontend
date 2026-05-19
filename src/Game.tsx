import { useState, useMemo, useCallback, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, Color, Square } from "chess.js";
import CustomDialog from "./components/CustomDialog";
import {
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
  Box,
} from "@mui/material";
import socket from "./socket";
import { BoardOrientation } from "react-chessboard/dist/chessboard/types";
import { PlayerObj } from "./InitGame";

interface GameObj {
  players: PlayerObj[];
  room: string;
  orientation: BoardOrientation;
  cleanup: () => void;
}

interface MoveObj {
  from: Square;
  to: Square;
  color: Color;
  promotions?: string;
}

const Game = ({ players, room, orientation, cleanup }: GameObj) => {
  const chess = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(chess.fen());
  const [over, setOver] = useState("");

  const makeAMove = useCallback(
    (move: MoveObj) => {
      try {
        const result = chess.move(move); // update Chess instance
        setFen(chess.fen()); // update fen state to trigger a re-render

        console.log("over, checkmate", chess.isGameOver(), chess.isCheckmate());

        if (chess.isGameOver()) {
          // check if move led to "game over"
          if (chess.isCheckmate()) {
            // if reason for game over is a checkmate
            // Set message to checkmate.
            setOver(
              `Checkmate! ${chess.turn() === "w" ? "black" : "white"} wins!`,
            );
            // The winner is determined by checking which side made the last move
          } else if (chess.isDraw()) {
            // if it is a draw
            setOver("Draw"); // set message to "Draw"
          } else {
            setOver("Game over");
          }
        }

        return result;
      } catch (e) {
        console.error(e);
        return null;
      } // null if the move was illegal, the move object if the move was legal
    },
    [chess],
  );

  // onDrop function
  const onDrop = (
    sourceSquare: Square,
    targetSquare: Square,
    // piece: Piece,
  ) => {
    // orientation is either 'white' or 'black'. game.turn() returns 'w' or 'b'
    if (chess.turn() !== orientation[0]) return false; // <- 1 prohibit player from moving piece of other player

    if (players.length < 2) return false; // <- 2 disallow a move if the opponent has not joined

    const moveData = {
      from: sourceSquare,
      to: targetSquare,
      color: chess.turn(),
      promotion: "q", // promote to queen where possible
    };

    const move = makeAMove(moveData);

    // illegal move
    if (move === null) return false;

    socket.emit("move", {
      // <- 3 emit a move event.
      move,
      room,
    }); // this event will be transmitted to the opponent via the server

    return true;
  };

  useEffect(() => {
    socket.on("move", (move: MoveObj) => {
      makeAMove(move); //
    });
  }, [makeAMove]);

  useEffect(() => {
    socket.on("playerDisconnected", (player: PlayerObj) => {
      console.log({ player });
      setOver(`${player.username} has disconnected`); // set game over
    });
  }, []);

  // Game component returned jsx
  return (
    <Stack>
      <Card>
        <CardContent>
          <Typography variant="h5">Room ID: {room}</Typography>
        </CardContent>
      </Card>
      <Stack flexDirection="row" sx={{ pt: 2 }}>
        <div
          className="board"
          style={{
            maxWidth: 600,
            maxHeight: 600,
            flexGrow: 1,
          }}
        >
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            boardOrientation={orientation}
          />
        </div>
        {players.length > 0 && (
          <Box>
            <List>
              <ListSubheader>Players</ListSubheader>
              {players.map((p) => (
                <ListItem key={p.id}>
                  <ListItemText primary={p.username} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Stack>
      <CustomDialog // Game Over CustomDialog
        open={Boolean(over)}
        title={over}
        contentText={over}
        handleContinue={() => {
          socket.emit("closeRoom", { roomId: room });
          cleanup();
        }}
      />
    </Stack>
  );
};

export default Game;
