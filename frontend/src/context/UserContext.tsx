import { createContext, Dispatch, SetStateAction, useContext } from "react";
import { Opponent, Position } from "../pages/NewGame/utils";

export interface UserContextType {
  id: string;
  setId: Dispatch<SetStateAction<string>>;
  nickName: string;
  setNickName: Dispatch<SetStateAction<string>>;
  position: Position;
  setPosition: Dispatch<SetStateAction<Position>>;
  opponent: Opponent;
  setOpponent: Dispatch<SetStateAction<Opponent>>;
  opponentNikcName?: string;
  setOpponentNickName: Dispatch<SetStateAction<string | undefined>>;
  roomId?: string;
  setRoomId: Dispatch<SetStateAction<string | undefined>>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("User context not found");
  }

  return context;
};

export default UserContext;
