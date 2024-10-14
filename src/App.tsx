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
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import Layout from "./Layout";
import { Covrflow, Media, useCovrflow } from "./components/Covrflow";
import { Leva, buttonGroup, folder, useControls } from "leva";
import { Mesh, Object3D } from "three";
import { type Videos } from "pexels";

const queryClient = new QueryClient();

const VITE_PEXELS_API_KEY: string = import.meta.env.VITE_PEXELS_API_KEY;

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
    isFetching: { value: false, disabled: true },
    pexels: folder(
      {
        query: "romance",
        perPage: 10,
        size: {
          value: "small" as const,
          options: ["small", "medium", "large"] as const,
        },
        orientation: {
          value: "portrait" as const,
          options: ["portrait", "landscape", "square"] as const,
        },
      },
      { collapsed: true }
    ),
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
        <Medias
          query={gui.query}
          setMedias={setMedias}
          setIsFetching={(isFetching) => setGui({ isFetching })}
          options={{
            size: gui.size,
            orientation: gui.orientation,
            perPage: gui.perPage,
          }}
        />
      </Covrflow>

      {/* <Box ref={boxRef} args={[6, 6, 6]} /> */}
    </>
  );
}

function Medias({
  query,
  setMedias,
  setIsFetching,
  options = {
    size: "small",
    perPage: 10,
    orientation: "portrait",
  },
}: {
  query: string;
  setMedias: (data: Media[]) => void;
  setIsFetching: (value: boolean) => void;
  options?: {
    size?: "small" | "medium" | "large";
    orientation?: "portrait" | "landscape" | "square";
    perPage: number;
  };
}) {
  const {
    posState: [pos],
  } = useCovrflow();

  const page = Math.ceil(Math.abs(pos) / options.perPage + 0.0001);
  // console.log("page=", page);

  const fetchMedias = async ({ pageParam }: { pageParam: number }) => {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${query}&orientation=${options.orientation}&size=${options.size}&per_page=${options.perPage}&page=${pageParam}`,
      {
        headers: {
          Authorization: VITE_PEXELS_API_KEY,
        },
      }
    );
    const json: Videos = await response.json();

    return json.videos.map(({ video_pictures, video_files }) => ({
      color: "gray",
      image: video_pictures.find(({ nr }) => nr === 0)!.picture,
      video: video_files[0].link,
    }));
  };

  const { data, fetchNextPage, isFetching } = useInfiniteQuery({
    queryKey: [
      "medias",
      query,
      options.perPage,
      options.size,
      options.orientation,
    ],
    queryFn: fetchMedias,
    initialPageParam: page,
    // placeholderData: keepPreviousData,
    getNextPageParam: () => page,
  });

  useEffect(() => {
    setIsFetching(isFetching);
  }, [isFetching, setIsFetching]);

  useEffect(() => {
    // console.log("page=", page);
    if (!data?.pageParams.includes(page)) {
      fetchNextPage();
    }
  }, [data?.pageParams, fetchNextPage, page]);

  useEffect(() => {
    if (data) {
      // console.log("data=", data);
      const medias = data.pages.flat();

      setMedias(medias);
    }
  }, [data, setMedias]);

  return null;
}
