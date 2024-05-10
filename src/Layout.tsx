import * as THREE from "three";
import { SpotLightHelper } from "three";

import { type ElementRef, type ReactNode, useEffect, useRef } from "react";
// import { useFrame } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { Environment, PerspectiveCamera, useHelper } from "@react-three/drei";

import { useControls, folder } from "leva";

import Gamepads from "./Gamepads";
import Ground from "./components/Ground";

function Layout({
  children,
  bg = "#393939",
}: {
  children?: ReactNode;
  bg?: string;
}) {
  const [gui, setGui] = useControls(() => ({
    Layout: folder(
      {
        bg,
        grid: false,
        axes: false,
      },
      { collapsed: true }
    ),
  }));
  // console.log("gui=", gui);

  const XRsession = useXR((state) => state.session);
  const isAR = XRsession && XRsession.environmentBlendMode === "alpha-blend";

  // const spotLightRef = useRef(null);
  // useHelper(spotLightRef, SpotLightHelper, "yellow");

  return (
    <>
      <Camera />

      <Gamepads />

      {!isAR && (
        <Environment background>
          <mesh scale={100}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshBasicMaterial color={gui.bg} side={THREE.BackSide} />
          </mesh>
        </Environment>
      )}

      <spotLight
        // ref={spotLightRef}
        position={[15, 15, 15]}
        // angle={0.3}
        penumbra={2}
        castShadow
        intensity={500}
        shadow-bias={-0.0001}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <ambientLight intensity={2} />

      {gui.grid && <gridHelper args={[30, 30, 30]} position-y=".01" />}
      {gui.axes && <axesHelper args={[5]} />}

      {children}

      {!isAR && <Ground />}
    </>
  );
}

function Camera() {
  const [gui, setGui] = useControls(() => ({
    Camera: folder(
      {
        fov: 30,
        position: { value: [0, 1.8, 21.0], step: 0.1 }, // ~= position of the camera (the player holds the camera)
        lookAt: {
          value: [0, 0, 0],
          step: 0.1,
        },
      },
      { collapsed: true }
    ),
  }));

  const cameraRef = useRef<ElementRef<typeof PerspectiveCamera>>(null); // non-XR camera

  const player = useXR((state) => state.player);

  //
  //  🤳 Camera (player position + cam lookAt rotation)
  //

  useEffect(() => {
    player.position.set(...gui.position);
  }, [player, gui.position]);

  // useFrame(() => {
  //   cameraRef.current?.lookAt(...gui.lookAt);
  // });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} fov={gui.fov} makeDefault />
    </>
  );
}

export default Layout;
