import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import List from "@mui/material/List";
import { NavLink } from "react-router-dom";

export interface DrawerSectionProps {
  name: string;
  path: string;
  icon: () => JSX.Element;
}

interface DrawerElProps {
  elements: DrawerSectionProps[];
}

const DrawerSection = ({ elements }: DrawerElProps) => {
  return (
    <List>
      {elements.map(({ name, path, icon }) => (
        <ListItem
          key={name}
          component={NavLink}
          to={path}
          disablePadding
          sx={{ display: "block", color: "inherit" }}
        >
          <ListItemButton
            sx={[{ minHeight: 48, px: 2.5 }, { justifyContent: "initial" }]}
          >
            <ListItemIcon
              sx={[{ minWidth: 0, justifyContent: "center" }, { mr: 3 }]}
            >
              {icon()}
            </ListItemIcon>
            <ListItemText primary={name} sx={[{ opacity: 1 }]} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};

export default DrawerSection;
