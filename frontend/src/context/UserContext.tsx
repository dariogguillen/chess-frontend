import { createContext, Dispatch, SetStateAction, useContext } from "react";
import { Position } from "../pages/NewGame/utils";

export interface UserContextType {
  nickName: string;
  setNickName: Dispatch<SetStateAction<string>>;
  position: Position;
  setPosition: Dispatch<SetStateAction<Position>>;
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
