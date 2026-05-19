import {
  Button,
  Checkbox,
  Divider,
  Paper,
  Stack,
  styled,
  TextField,
  Typography,
} from "@mui/material";
import { ChangeEvent, MouseEvent, useState } from "react";
import { NavLink } from "react-router-dom";
import Container from "../../components/Container";
import ToggleButtons from "../../components/ToggleButton";
import { useUserContext } from "../../context/UserContext";
import socket from "../../utils/socket";
import { RoomObj } from "../Play/Play";
import {
  getOpponentButtonsProps,
  getPositionButtonsProps,
  getTimeButtonsProps,
  Opponent,
  Position,
  Time,
} from "./utils";

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
  ...theme.applyStyles("dark", {
    backgroundColor: "#1A2027",
  }),
}));

const NewGame = () => {
  const [time, setTime] = useState<Time>(Time.None);
  const [join, setJoin] = useState(false);

  const {
    id,
    nickName,
    setNickName,
    position,
    setPosition,
    opponent,
    setOpponent,
    setOpponentNickName,
    roomId,
    setRoomId,
  } = useUserContext();
  const defaultPlayerNickname = "Jugador 1";

  const handleOpponent = (
    _event: MouseEvent<HTMLElement>,
    newOpponent: Opponent,
  ) => setOpponent(newOpponent);

  const handlePosition = (_event: MouseEvent<HTMLElement>, newPos: Position) =>
    setPosition(newPos);

  const handleJoin = (_event: ChangeEvent<HTMLElement>, newValue: boolean) =>
    setJoin(newValue);

  const handleTime = (_event: MouseEvent<HTMLElement>, newTime: Time) =>
    setTime(newTime);

  const handleRoomId = (event: ChangeEvent<HTMLInputElement>) =>
    setRoomId(event.target.value);

  const handleNickName = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setNickName(value);
    if (value) setNickName(value);
    else setNickName(defaultPlayerNickname);
  };

  const handleOnClick = () => {
    if (!join) {
      socket.emit(
        "createRoom",
        { id, nickName, position },
        (roomId: string) => {
          console.log({ creatRoom: roomId });
          setRoomId(roomId);
        },
      );
    } else {
      socket.emit(
        "joinRoom",
        { roomId, id, nickName, position },
        (room: RoomObj) => {
          // r is the response from the server
          // TODO: if (room.error) return setRoomError(room.message || "ERROR JOINING A ROOM"); // if an error is returned in the response set roomError to the error message and exit
          console.log("response:", room);
          if (room.opponent) setOpponentNickName(room?.player?.nickName); // set players array to the array of players in the room
          // setOrientation("black"); // set orientation as black
        },
      );
    }
  };

  const positionButtons = getPositionButtonsProps(position, handlePosition);
  const opponentButtons = getOpponentButtonsProps(opponent, handleOpponent);
  const timeButtons = getTimeButtonsProps(time, handleTime);

  return (
    <Container containerProps={{ maxWidth: "md" }}>
      <Typography variant="h3" gutterBottom align="center">
        Configura tu juego
      </Typography>
      <Stack
        direction="column"
        spacing={1}
        alignContent="center"
        divider={<Divider orientation="vertical" flexItem />}
      >
        <Item>
          <Typography variant="body1">Elige un apodo:</Typography>
          <TextField
            label="Apodo"
            variant="standard"
            placeholder="Jugador 1"
            fullWidth
            value={nickName === defaultPlayerNickname ? "" : nickName}
            onChange={handleNickName}
          />
        </Item>
        <Item>
          <Typography variant="body1">
            <Checkbox checked={join} value={join} onChange={handleJoin} />
            Unirse a una partida
          </Typography>
          <TextField
            label="Room Id"
            variant="standard"
            disabled={!join}
            fullWidth
            value={roomId || ""}
            onChange={handleRoomId}
          />
        </Item>
        <Item>
          <Typography variant="body1" gutterBottom>
            Jugar con:
          </Typography>
          <ToggleButtons {...positionButtons} disabled={join} />
        </Item>
        <Item>
          <Typography variant="body1" gutterBottom>
            Jugar contra:
          </Typography>
          <ToggleButtons {...opponentButtons} disabled={join} />
        </Item>
        <Item>
          <Typography variant="body1" gutterBottom>
            <Checkbox disabled />
            Timer (min). <small>Esta en progreso</small>
          </Typography>
          <ToggleButtons {...timeButtons} disabled={join} />
        </Item>
        <NavLink
          onClick={handleOnClick}
          to={`/play?roomId=${roomId}`}
          style={{ display: "contents" }}
        >
          <Button variant="contained">
            {join ? "Uniser a partida" : "Jugar"}
          </Button>
        </NavLink>
      </Stack>
    </Container>
  );
};

export default NewGame;
