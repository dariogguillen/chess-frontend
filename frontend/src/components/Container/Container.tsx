import { Box, BoxProps, Container, ContainerProps } from "@mui/material";
import { DRAWER_WIDTH } from "../Drawer/Drawer";
import { ReactNode } from "react";

export interface CustomContaienrProps {
  containerProps?: Omit<ContainerProps, "children">;
  boxProps?: Omit<BoxProps, "children">;
  children: ReactNode;
}

const CustomContaienr = ({
  children,
  containerProps: {
    maxWidth: cmw = "sm",
    component: cComp = "main",
    ...cProps
  } = {},
  boxProps: { sx: bsx = {}, ...bProps } = {},
}: CustomContaienrProps) => {
  return (
    <Container maxWidth={cmw} component={cComp} {...cProps}>
      <Box
        sx={{
          margin: "auto",
          height: "100vh",
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          alignContent: "center",
          ...bsx,
        }}
        {...bProps}
      >
        {children}
      </Box>
    </Container>
  );
};

export default CustomContaienr;
