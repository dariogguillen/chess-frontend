import {
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  Paper,
  Stack,
  styled,
  Typography,
} from "@mui/material";
import { useState } from "react";
import ToggleButtons from "../../components/ToggleButton";
import {
  getOpponentButtonsProps,
  getPositionButtonsProps,
  getTimeButtonsProps,
  Opponent,
  Position,
  Time,
} from "./utils";
import { NavLink } from "react-router-dom";
import { DRAWER_WIDTH } from "../../components/Drawer/Drawer";

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

  const handleOpponent = (
    _event: React.MouseEvent<HTMLElement>,
    newOpponent: Opponent,
  ) => setOpponent(newOpponent);

  const handlePosition = (
    _event: React.MouseEvent<HTMLElement>,
    newPos: Position,
  ) => setPosition(newPos);

  const handleTime = (_event: React.MouseEvent<HTMLElement>, newTime: Time) =>
    setTime(newTime);

  const positionButtons = getPositionButtonsProps(position, handlePosition);
  const opponentButtons = getOpponentButtonsProps(opponent, handleOpponent);
  const timeButtons = getTimeButtonsProps(time, handleTime);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          margin: "auto",
          height: "100vh",
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          alignContent: "center",
        }}
      >
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
            <Typography variant="body1" gutterBottom>
              Jugar con:
            </Typography>
            <ToggleButtons {...positionButtons} />
          </Item>
          <Item>
            <Typography variant="body1" gutterBottom>
              Jugar contra:
            </Typography>
            <ToggleButtons {...opponentButtons} />
          </Item>
          <Item>
            <Typography variant="body1" gutterBottom>
              <Checkbox disabled />
              Timer (min). <small>Esta en progreso</small>
            </Typography>
            <ToggleButtons {...timeButtons} />
          </Item>
          <NavLink
            to={`/play?position=${position}&opponent=${opponent}&time=${time}`}
            style={{ display: "contents" }}
          >
            <Button variant="contained">Jugar</Button>
          </NavLink>
        </Stack>
      </Box>
    </Container>
  );
};

export default NewGame;
