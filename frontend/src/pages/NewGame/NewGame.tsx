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
import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import ShortUniqueId from "short-unique-id";
import Container from "../../components/Container";
import ToggleButtons from "../../components/ToggleButton";
import { useUserContext } from "../../context/UserContext";
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
    nickName,
    setNickName,
    position,
    setPosition,
    opponent,
    setOpponent,
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

  const generateRoomId = useCallback(() => {
    return new ShortUniqueId({ length: 12 }).randomUUID();
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const roomIdOpt = searchParams.get("roomId");

  const handleOnClick = () => {
    if (!join) {
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
    }
  };

  useEffect(() => {
    if (roomIdOpt) {
      setRoomId(roomIdOpt);
      setJoin(true);
    }
  }, [roomIdOpt, setRoomId, setJoin]);

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
