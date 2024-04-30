import {
  ComponentProps,
  ElementRef,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from "react";
import styled from "@emotion/styled";
import { Canvas, useThree } from "@react-three/fiber";
import { Box, useKeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { XR, Controllers, Hands, VRButton, Interactive } from "@react-three/xr";
import { useControls } from "leva";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import Layout from "./Layout";
import Cube from "./components/Cube";
import Ball from "./components/Ball";
import Ground from "./components/Ground";
import { Rope } from "./components/Rope";

function App() {
  return (
    <Styled>
      <VRButton />
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
            debug
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

function arr2Vec(arr: [number, number, number]) {
  return { x: arr[0], y: arr[1], z: arr[2] };
}

// Fonction pour ajuster x dans l'intervalle [0, 1]
function adjustToTimeline(x: number) {
  x = x % 1; // Utilisation du modulo pour limiter x entre -1 et 1
  if (x < 0) x += 1; // Ajustement pour que x soit toujours positif
  return x;
}

const r = 5;

const POSITIONS = {
  backleft: {
    position: [
      -2 * r * Math.cos(Math.PI / 6),
      0,
      -1.5 * r * Math.sin(Math.PI / 6),
    ],
    rotation: [0, Math.PI / 3, 0],
    opacity: 0,
  },
  left: {
    position: [-r * Math.cos(Math.PI / 6), 0, -r * Math.sin(Math.PI / 6)],
    rotation: [0, Math.PI / 3, 0],
    opacity: 1,
  },
  front: {
    position: [0, 0, r],
    rotation: [0, 0, 0],
    opacity: 1,
  },
  right: {
    position: [r * Math.cos(Math.PI / 6), 0, -r * Math.sin(Math.PI / 6)],
    rotation: [0, -Math.PI / 3, 0],
    opacity: 1,
  },
  backright: {
    position: [
      2 * r * Math.cos(Math.PI / 6),
      0,
      -1.5 * r * Math.sin(Math.PI / 6),
    ],
    rotation: [0, -Math.PI / 3, 0],
    opacity: 0,
  },
} satisfies {
  [k in "backleft" | "left" | "front" | "right" | "backright"]: {
    position: [number, number, number];
    rotation: [number, number, number];
    opacity: number;
  };
};

const Panel = forwardRef<ElementRef<typeof Box>, ComponentProps<typeof Box>>(
  (props, ref) => {
    return (
      <Box castShadow receiveShadow ref={ref} args={[3, 5, 0.1]} {...props}>
        <meshStandardMaterial transparent opacity={1} />
      </Box>
    );
  }
);

function Scene() {
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

  const [tl] = useState(gsap.timeline({ paused: true }));

  const panel1Ref = useRef<ElementRef<typeof Box>>(null);
  const panel2Ref = useRef<ElementRef<typeof Box>>(null);
  const panel3Ref = useRef<ElementRef<typeof Box>>(null);
  const panel4Ref = useRef<ElementRef<typeof Box>>(null);

  useGSAP(
    () => {
      if (
        !panel1Ref.current ||
        !panel2Ref.current ||
        !panel3Ref.current ||
        !panel4Ref.current
      )
        return;

      const duration = 1;
      const ease = "none";

      //
      // 1: backleft -> left
      //

      const tl1 = gsap.timeline();

      const tw1Pos = gsap.fromTo(
        panel1Ref.current.position,
        arr2Vec(POSITIONS.backleft.position),
        { ...arr2Vec(POSITIONS.left.position), duration, ease }
      );
      const tw1Rot = gsap.fromTo(
        panel1Ref.current.rotation,
        arr2Vec(POSITIONS.backleft.rotation),
        { ...arr2Vec(POSITIONS.left.rotation), duration, ease }
      );
      const tw1Transparency = gsap.fromTo(
        panel1Ref.current.material,
        { opacity: POSITIONS.backleft.opacity },
        {
          opacity: POSITIONS.left.opacity,
          duration,
          ease: "circ.in",
        }
      );

      tl1.add(tw1Rot, 0);
      tl1.add(tw1Pos, 0);
      tl1.add(tw1Transparency, 0);

      //
      // 2: left -> front
      //

      const tl2 = gsap.timeline();

      const tw2Pos = gsap.fromTo(
        panel2Ref.current.position,
        arr2Vec(POSITIONS.left.position),
        { ...arr2Vec(POSITIONS.front.position), duration, ease }
      );
      const tw2Rot = gsap.fromTo(
        panel2Ref.current.rotation,
        arr2Vec(POSITIONS.left.rotation),
        { ...arr2Vec(POSITIONS.front.rotation), duration, ease }
      );

      tl2.add(tw2Rot, 0);
      tl2.add(tw2Pos, 0);

      //
      // 3: front -> right
      //

      const tl3 = gsap.timeline();

      const tw3Pos = gsap.fromTo(
        panel3Ref.current.position,
        arr2Vec(POSITIONS.front.position),
        { ...arr2Vec(POSITIONS.right.position), duration, ease }
      );
      const tw3Rot = gsap.fromTo(
        panel3Ref.current.rotation,
        arr2Vec(POSITIONS.front.rotation),
        { ...arr2Vec(POSITIONS.right.rotation), duration, ease }
      );

      tl3.add(tw3Rot, 0);
      tl3.add(tw3Pos, 0);

      //
      // 4: right -> backright
      //

      const tl4 = gsap.timeline();

      const tw4Pos = gsap.fromTo(
        panel4Ref.current.position,
        arr2Vec(POSITIONS.right.position),
        { ...arr2Vec(POSITIONS.backright.position), duration, ease }
      );
      const tw4Rot = gsap.fromTo(
        panel4Ref.current.rotation,
        arr2Vec(POSITIONS.right.rotation),
        { ...arr2Vec(POSITIONS.backright.rotation), duration, ease }
      );
      const tw4Transparency = gsap.fromTo(
        panel4Ref.current.material,
        { opacity: POSITIONS.right.opacity },
        {
          opacity: POSITIONS.backright.opacity,
          duration,
          ease: "circ.in",
        }
      );

      tl4.add(tw4Rot, 0);
      tl4.add(tw4Pos, 0);
      tl4.add(tw4Transparency, 0);

      //
      // all
      //

      tl.clear();
      tl.add(tl1, 0);
      tl.add(tl2, 0);
      tl.add(tl3, 0);
      tl.add(tl4, 0);
    },
    { dependencies: [tl] }
  );

  //
  // GUI
  //

  const [gui, setGui] = useControls(() => ({
    seek: {
      value: 0,
      min: -9.9,
      max: 9.9,
      step: 0.001,
    },
  }));

  useEffect(() => {
    tl.seek(adjustToTimeline(gui.seek));
  }, [tl, gui.seek]);

  return (
    <>
      <group position={[0, 2.5, 0]}>
        <Panel ref={panel1Ref} position={POSITIONS.backleft.position} />
        <Panel ref={panel2Ref} position={POSITIONS.left.position} />
        <Panel ref={panel3Ref} position={POSITIONS.front.position} />
        <Panel ref={panel4Ref} position={POSITIONS.right.position} />
      </group>

      <Ground />
    </>
  );
}
