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
  open: boolean;
}

const DrawerSection = ({ elements, open }: DrawerElProps) => {
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
            sx={[
              { minHeight: 48, px: 2.5 },
              open
                ? { justifyContent: "initial" }
                : { justifyContent: "center" },
            ]}
          >
            <ListItemIcon
              sx={[
                { minWidth: 0, justifyContent: "center" },
                open ? { mr: 3 } : { mr: "auto" },
              ]}
            >
              {icon()}
            </ListItemIcon>
            <ListItemText
              primary={name}
              sx={[open ? { opacity: 1 } : { opacity: 0 }]}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};

export default DrawerSection;
