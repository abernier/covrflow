import {
  ComponentProps,
  Dispatch,
  ElementRef,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "@emotion/styled";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import gsap from "gsap";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import Layout from "./Layout";
import { Covrflow, Media, useCovrflow } from "./components/Covrflow";
import { Leva, buttonGroup, useControls } from "leva";
import { Mesh, Object3D } from "three";
import { type Videos } from "pexels";

const queryClient = new QueryClient();

function App() {
  const gui = useControls({
    onDemandFrameloop: { label: "onDemand", value: false },
  });

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
        frameloop={gui.onDemandFrameloop ? "demand" : undefined}
      >
        <XR>
          <Controllers />
          <Hands />

          {/* <Physics gravity={[0, -60, 0]}> */}
          <Layout>
            <QueryClientProvider client={queryClient}>
              <Scene />
            </QueryClientProvider>
          </Layout>
          {/* </Physics> */}
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

  // useEffect(() => {
  //   const updateRoot = gsap.updateRoot;
  //   gsap.ticker.remove(updateRoot);
  // }, []);
  // useFrame(({ clock }) => {
  //   // gsap.updateRoot(clock.elapsedTime);
  // });

  const [gui, setGui] = useControls(() => ({
    query: "romance",
    pos: {
      value: 0,
      disabled: true,
    },
    velocity: {
      value: 0,
      min: -30,
      max: 30,
      step: 1,
      disabled: true,
    },
    nav: buttonGroup({
      label: "navigation",
      opts: {
        left: () => covrflowRef.current?.go((val) => val - 1),
        right: () => covrflowRef.current?.go((val) => val + 1),
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

  // sync coverflow `pos` to GUI
  useFrame(() => {
    setGui({
      pos: covrflowRef.current?.posState[0],
      velocity: covrflowRef.current?.trackerRef.current.get("current"),
    });
  });

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

  const [medias, setMedias] = useState<Media[]>();

  return (
    <>
      <Covrflow
        ref={covrflowRef}
        options={{
          sensitivity: gui.sensitivity,
          duration: gui.duration,
          debug: gui.debug,
        }}
        medias={medias}
      >
        <Medias query={gui.query} set={setMedias} />
      </Covrflow>

      {/* <Box ref={boxRef} args={[6, 6, 6]} /> */}
    </>
  );
}

function Medias({
  query,
  set,
}: {
  query: string;
  set: Dispatch<SetStateAction<Media[] | undefined>>;
}) {
  const {
    posState: [pos],
  } = useCovrflow();

  const perPage = 20;
  const page = Math.ceil(Math.abs(pos) / perPage);
  console.log("page=", page);

  const { data } = useQuery({
    queryKey: [query, perPage, page],
    queryFn: async () => {
      const response = await fetch(
        `https://api.pexels.com/videos/search?query=${query}&orientation=portrait&size=small&per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: import.meta.env.VITE_PEXELS_API_KEY,
          },
        }
      );
      const json: Videos = await response.json();

      return json.videos.map((v) => ({
        color: "gray",
        image: v.video_pictures.find((p) => p.nr === 0)!.picture,
        video: v.video_files[0].link,
      }));
    },
  });

  set(data);

  return null;
}
