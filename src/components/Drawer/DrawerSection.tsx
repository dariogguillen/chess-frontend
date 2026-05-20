import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import List from '@mui/material/List';
import { NavLink } from 'react-router-dom';

export interface DrawerSectionElement {
  name: string;
  path: string;
  icon: () => JSX.Element;
}

export interface DrawerSectionProps {
  elements: DrawerSectionElement[];
}

/**
 * Render a single list of drawer entries. Each entry becomes a NavLink
 * so that `react-router-dom` can attach the `.active` class on the
 * matching route, which the MUI theme styles via `MuiListItem`'s
 * `&.active` override.
 */
const DrawerSection = ({ elements }: DrawerSectionProps) => {
  return (
    <List>
      {elements.map(({ name, path, icon }) => (
        <ListItem
          key={name}
          component={NavLink}
          to={path}
          disablePadding
          sx={{ display: 'block', color: 'inherit' }}
        >
          <ListItemButton sx={{ minHeight: 48, px: 2.5, justifyContent: 'initial' }}>
            <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mr: 3 }}>
              {icon()}
            </ListItemIcon>
            <ListItemText primary={name} sx={{ opacity: 1 }} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};

export default DrawerSection;
