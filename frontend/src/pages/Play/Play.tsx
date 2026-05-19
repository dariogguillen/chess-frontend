import {
  Box,
  CircularProgress,
  Grid2 as Grid,
  Typography,
} from "@mui/material";
import { Chess, Color, Square } from "chess.js";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useSearchParams } from "react-router-dom";
import Container from "../../components/Container";
import { useUserContext } from "../../context/UserContext";
import socket from "../../utils/socket";

export interface PlayerObj {
  id: string;
  nickName: string;
}
export interface RoomObj {
  id?: string;
  error?: string;
  message?: string;
  player?: PlayerObj;
  opponent?: PlayerObj;
}

interface MoveObj {
  from: Square;
  to: Square;
  color: Color;
  promotions?: string;
}

const Play = () => {
  const { nickName, position, opponentNikcName, roomId } = useUserContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const roomIdOpt = searchParams.get("roomId");

  useEffect(() => {
    if (roomIdOpt && roomIdOpt !== roomId) {
      console.log({ roomId, roomIdOpt });
      setSearchParams((p) => ({ ...p, roomId }));
    }
  });

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

  const onDrop = (
    sourceSquare: Square,
    targetSquare: Square,
    // piece: Piece,
  ) => {
    // position is either 'white' or 'black'. game.turn() returns 'w' or 'b'
    if (chess.turn() !== position[0]) return false; // <- 1 prohibit player from moving piece of other player

    // if (players.length < 2) return false; // <- 2 disallow a move if the opponent has not joined

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
      roomId,
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
      setOver(`${player.nickName} has disconnected`); // set game over
    });
  }, []);

  // Game component returned jsx
  return (
    <Container containerProps={{ maxWidth: "xl" }}>
      <Grid container spacing={2}>
        <Grid size={8}>
          <Typography variant="body1">
            {opponentNikcName || (
              <Fragment>
                Esperando oponente
                <CircularProgress size="15px" sx={{ marginLeft: "10px" }} />
              </Fragment>
            )}
          </Typography>
        </Grid>
        <Grid size={4}>
          <Typography variant="body1">Room ID: {roomId}</Typography>
        </Grid>
        <Grid size={12}>
          <Box flexGrow={1}>
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              // boardOrientation={position}
              areArrowsAllowed={true}
            />
          </Box>
        </Grid>
        <Grid size={8}>
          <Typography variant="body1">{nickName}</Typography>
        </Grid>
        <Grid size={4}>
          <Typography variant="body1">Options</Typography>
        </Grid>
        <Grid size={12}>
          <Box flexGrow={1}>
            <Typography variant="body1">Moves</Typography>
          </Box>
        </Grid>
      </Grid>
      {/* <CustomDialog // Game Over CustomDialog */}
      {/*   open={Boolean(over)} */}
      {/*   title={over} */}
      {/*   contentText={over} */}
      {/*   handleContinue={() => { */}
      {/*     socket.emit("closeRoom", { roomId: room }); */}
      {/*     cleanup(); */}
      {/*   }} */}
      {/* /> */}
    </Container>
  );
};

export default Play;
