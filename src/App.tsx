import {
  ComponentProps,
  ElementRef,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "@emotion/styled";
import { Canvas, useThree } from "@react-three/fiber";
import { Box, useKeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import {
  XR,
  Controllers,
  Hands,
  ARButton,
  useHitTest,
  useXREvent,
} from "@react-three/xr";

import Layout from "./Layout";
import { Covrflow } from "./components/Covrflow";
import { Leva, buttonGroup, useControls } from "leva";
import { Mesh, Object3D } from "three";

function App() {
  return (
    <Styled>
      <Leva collapsed />

      <ARButton />

      <Canvas
        shadows
        // camera={{
        //   position: [0, 15, 5],
        //   fov: 55,
        // }}
        //
      >
        <XR>
          <Controllers />
          <Hands />

          <Physics
            // debug
            gravity={[0, -60, 0]}
            // timeStep={1 / 60}
            //
          >
            <Layout>
              <Scene />
            </Layout>
          </Physics>
        </XR>
      </Canvas>
    </Styled>
  );
}
export const Styled = styled.div`
  position: fixed;
  inset: 0;
`;
export default App;

function Scene() {
  const covrflowRef = useRef<ElementRef<typeof Covrflow>>(null);

  const posState = useState(0);
  const [pos, setPos] = posState;

  const fooState = useState(0);
  const [foo, setFoo] = fooState;

  const [gui, setGui] = useControls(() => ({
    pos: {
      value: 0,
      onChange(v) {
        setPos(v);
      },
    },
    nav: buttonGroup({
      label: "navigation",
      opts: {
        prev: (get) => {
          covrflowRef.current?.go((previous) => previous - 1);
        },
        next: (get) => {
          covrflowRef.current?.go((previous) => previous + 1);
        },
      },
    }),
    sensitivity: {
      value: 1 / 100,
      min: 1 / 500,
      max: 1 / 50,
      step: 1 / 1000,
    },
    duration: {
      value: [0.5, 1.5],
      min: 0.01,
      max: 2,
    },
    debug: false,
  }));

  useEffect(() => {
    setGui({ pos });
  }, [pos, setGui]);

  {
    //
    // ESC key to exit XR
    //

    const gl = useThree((state) => state.gl);
    // gl.xr.setFramebufferScaleFactor(2.0);

    const escPressed = useKeyboardControls((state) => state.esc);
    useEffect(() => {
      gl.xr.getSession()?.end(); // https://stackoverflow.com/a/71566927/133327
    }, [escPressed, gl.xr]);
  }

  // const [obj3d] = useState(new Object3D());

  // // useHitTest((hitMatrix) => {
  // //   console.log("hitTest");
  // //   if (!covrflowRef.current) return;

  // //   hitMatrix.decompose(
  // //     covrflowRef.current.position,
  // //     covrflowRef.current.quaternion,
  // //     covrflowRef.current.scale
  // //   );
  // // });

  // const boxRef = useRef<Mesh>(null);

  // useHitTest((hitMatrix) => {
  //   if (boxRef.current) {
  //     hitMatrix.decompose(
  //       boxRef.current.position,
  //       boxRef.current.quaternion,
  //       boxRef.current.scale
  //     );
  //   }
  // });

  // useXREvent("select", (e) => {
  //   console.log("select", e);
  // });

  // useXREvent("hover", (e) => {
  //   console.log("hover", e);
  // });

  // useXREvent("squeeze", (e) => {
  //   console.log("squeeze", e);
  // });

  return (
    <>
      <Covrflow
        ref={covrflowRef}
        posState={posState}
        // posTargetState={fooState}
        options={{
          sensitivity: gui.sensitivity,
          duration: gui.duration,
          debug: gui.debug,
        }}
      />

      {/* <Box ref={boxRef} args={[6, 6, 6]} /> */}
    </>
  );
}
