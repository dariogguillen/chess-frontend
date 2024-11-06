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
import { ChangeEvent, MouseEvent, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import UrlParser from "url-parse";
import Container from "../../components/Container";
import ToggleButtons from "../../components/ToggleButton";
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
  const [position, setPosition] = useState<Position>(Position.White);
  const [opponent, setOpponent] = useState<Opponent>(Opponent.Friend);
  const [time, setTime] = useState<Time>(Time.None);
  const [join, setJoin] = useState(false);
  const [roomId, setRoomId] = useState("");

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

  useEffect(() => {
    const url1 = new UrlParser(roomId);
    console.log(url1);
  }, [roomId]);

  const positionButtons = getPositionButtonsProps(position, handlePosition);
  const opponentButtons = getOpponentButtonsProps(opponent, handleOpponent);
  const timeButtons = getTimeButtonsProps(time, handleTime);

  return (
    <Container>
      <Typography variant="h3" gutterBottom align="center">
        Configura tu juego
      </Typography>
      <Stack
        direction="column"
        spacing={2}
        alignContent="center"
        divider={<Divider orientation="vertical" flexItem />}
      >
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
            value={roomId}
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
          to={`/play?position=${position}&opponent=${opponent}&time=${time}`}
          style={{ display: "contents" }}
        >
          <Button variant="contained">Jugar</Button>
        </NavLink>
      </Stack>
    </Container>
  );
};

export default NewGame;
