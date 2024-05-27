import * as THREE from "three";
import {
  ComponentProps,
  ElementRef,
  MutableRefObject,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  useMemo,
  useImperativeHandle,
  Dispatch,
  SetStateAction,
  useEffect,
  Suspense,
} from "react";
import { Box, useVideoTexture } from "@react-three/drei";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  EventTypes,
  createUseGesture,
  dragAction,
  pinchAction,
} from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/three";
import { InertiaPlugin, VelocityTracker } from "gsap/InertiaPlugin";
import { Interactive, useInteraction } from "@react-three/xr";
import { Vector2 } from "three";
import merge from "deepmerge";
import { invalidate, useFrame } from "@react-three/fiber";
import * as geometry from "maath/geometry";

gsap.registerPlugin(InertiaPlugin);

const useGesture = createUseGesture([dragAction, pinchAction]);

//
// Utilities
//

//
// circ
//
// Returns the element at the circular index in an array, from the middle of the array by default
//
// @param i - The index to access, can be positive or negative.
// @param arr - The array from which to retrieve the element.
// @param middle - start counting i from the middle (can be false, "lower" or "upper" in case of even arr)?
//
// Examples:
//
// arrA = ["01.mp4", "02.mp4", "03.mp4", "04.mp4", "05.mp4"]
// arrB = ["01.mp4", "02.mp4", "03.mp4", "04.mp4"]
//
// circ( 0, arrA) => "03.mp4"   // middle element
// circ(-1, arrA) => "02.mp4"   // 1 element before the middle
// circ(-2, arrA) => "01.mp4"   // 2 elements before the middle
// circ(-3, arrA) => "05.mp4"   // 3 elements before the middle
// circ( 1, arrA) => "04.mp4"   // 1 element after the middle
//
// circ(0, arrB) => "02.mp4"            // when arr is even, it takes the "lower" middle element by default
// circ(0, arrB, "upper") => "03.mp4"   // but we can specify to take the "upper" one
//
// circ(0, arrA, false) => "01.mp4"     // we can also specify to not start from the middle
//

function circ<T>(
  arr: T[],
  i: number,
  middle: "lower" | "upper" | false = "lower"
) {
  let centerOffset = 0;
  if (middle) {
    const even = arr.length % 2 === 0;
    centerOffset = Math.floor(
      arr.length / 2 + (even && middle === "lower" ? -1 : 0)
    );
  }

  return arr.at((i + centerOffset) % arr.length) as T;
}

function arr2vec(arr: [number, number, number]) {
  const [x, y, z] = arr;

  return { x, y, z };
}

function mod(x: number, n = 1) {
  //
  // https://chat.openai.com/share/743ba98b-a8b0-488b-af0c-0aac705233d3
  //
  // mod(.8) => .8
  // mod(4.3) => .3
  // mod(-0.7) => .3
  // mod(-9.6) => .4
  //

  x = x % n; // limit between -1 and 1
  if (x < 0) x += n; // for x to be always positive
  return x;
}

const createRequiredContext = <T,>() => {
  //
  // Create a strongly typed context and a hook
  //
  // see: https://www.totaltypescript.com/workshops/advanced-react-with-typescript/advanced-hooks/strongly-typing-react-context/solution
  //

  const Ctx = createContext<T | null>(null);

  const useCtx = () => {
    const contextValue = useContext(Ctx);

    if (contextValue === null) {
      throw new Error("Context value is null");
    }

    return contextValue;
  };

  return [useCtx, Ctx.Provider] as const;
};

function objectFit(r: number, R: number, size: "cover" | "contain" = "cover") {
  // https://stackoverflow.com/a/78535892/133327

  const { repeat, offset } = new THREE.Texture();

  if (size === "cover") {
    if (r > R) {
      repeat.x = R / r;
      repeat.y = 1;
    } else {
      repeat.x = 1;
      repeat.y = r / R;
    }
  } else {
    if (r > R) {
      repeat.x = 1;
      repeat.y = r / R;
    } else {
      repeat.x = R / r;
      repeat.y = 1;
    }
  }

  // center
  offset.y = (1 - repeat.y) / 2;
  offset.x = (1 - repeat.x) / 2;

  return { repeat, offset };
}

//
// Constants
//

const kulers = [
  0xecfdf5, 0xd1fae5, 0xa7f3d0, 0x6ee7b7, 0x34d399, 0x10b981, 0x059669,
  0x047857, 0x065f46, 0x064e3b, 0x022c22,
].reverse();

// List of films from https://gist.github.com/jsturgis/3b19447b304616f18657
const films = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  // "01.mp4",
  // "02.mp4",
  // "03.mp4",
  // "04.mp4",
  // "05.mp4",
];

const r = 5;
const TRANSLUCENCY = 0;
const STATES = {
  backleft: {
    position: [
      -2 * r * Math.cos(Math.PI / 3),
      0,
      -1.5 * r * Math.sin(Math.PI / 3),
    ],
    rotation: [0, Math.PI / 3, 0],
    opacity: TRANSLUCENCY,
  },
  left: {
    position: [-r * Math.cos(Math.PI / 3), 0, -r * Math.sin(Math.PI / 3)],
    rotation: [0, Math.PI / 3, 0],
    opacity: 1,
  },
  front: {
    position: [0, 0, r],
    rotation: [0, 0, 0],
    opacity: 1,
  },
  right: {
    position: [r * Math.cos(Math.PI / 3), 0, -r * Math.sin(Math.PI / 3)],
    rotation: [0, -Math.PI / 3, 0],
    opacity: 1,
  },
  backright: {
    position: [
      2 * r * Math.cos(Math.PI / 3),
      0,
      -1.5 * r * Math.sin(Math.PI / 3),
    ],
    rotation: [0, -Math.PI / 3, 0],
    opacity: TRANSLUCENCY,
  },
} satisfies {
  [k in "backleft" | "left" | "front" | "right" | "backright"]: {
    position: [number, number, number];
    rotation: [number, number, number];
    opacity: number;
  };
};

//  ██████  ██████  ██    ██ ██████  ███████ ██       ██████  ██     ██
// ██      ██    ██ ██    ██ ██   ██ ██      ██      ██    ██ ██     ██
// ██      ██    ██ ██    ██ ██████  █████   ██      ██    ██ ██  █  ██
// ██      ██    ██  ██  ██  ██   ██ ██      ██      ██    ██ ██ ███ ██
//  ██████  ██████    ████   ██   ██ ██      ███████  ██████   ███ ███

const defaultOptions = {
  sensitivity: 1 / 200,
  duration: [0.5, 1.5] as [number, number],
  debug: false,
};
type Options = typeof defaultOptions;

export const Covrflow = forwardRef<
  ElementRef<typeof CovrflowProvider>,
  {
    options?: Options;
  } & ComponentProps<"group">
>(({ options, ...props }, ref) => {
  return (
    <group {...props}>
      <CovrflowProvider ref={ref} options={options}>
        <Panels />
      </CovrflowProvider>
    </group>
  );
});

// ██████  ██████   ██████  ██    ██ ██ ██████  ███████ ██████
// ██   ██ ██   ██ ██    ██ ██    ██ ██ ██   ██ ██      ██   ██
// ██████  ██████  ██    ██ ██    ██ ██ ██   ██ █████   ██████
// ██      ██   ██ ██    ██  ██  ██  ██ ██   ██ ██      ██   ██
// ██      ██   ██  ██████    ████   ██ ██████  ███████ ██   ██

type Pos = number;
type PosRef = MutableRefObject<Pos>;
type Seat = THREE.Mesh | null;

type Api = {
  posState: [Pos, Dispatch<SetStateAction<Pos>>];
  posTargetRef: PosRef;

  tlPanels: MutableRefObject<gsap.core.Timeline>;
  seat: MutableRefObject<Seat>;

  inertiaValueRef: PosRef;
  twInertia: MutableRefObject<gsap.core.Tween | undefined>;
  trackerRef: MutableRefObject<gsap.VelocityTrackerInstance>;

  damp: (end?: gsap.InertiaObject["end"]) => void;
  go: (
    x: number | ((prevPosTarget: number) => number),
    damping?: boolean
  ) => void;

  options: Options;
};

const [useCovrflow, Provider] = createRequiredContext<Api>();

export const CovrflowProvider = forwardRef<
  Api,
  {
    children: React.ReactNode;
    options?: Partial<Options>;
  }
>(({ children, options = {} }, ref) => {
  // console.log("CovrflowProvider");

  const opts = merge(defaultOptions, options, {
    arrayMerge: (dstArr, srcArr, options) => srcArr, // do not concat arrays (see: https://www.npmjs.com/package/deepmerge#arraymerge-example-overwrite-target-array)
  });

  const [pos, setPos] = useState(0);
  const posTargetRef = useRef(0);

  // frameloop="demand" https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance#on-demand-rendering
  useEffect(() => invalidate(), [pos]);

  const tlPanels = useRef(gsap.timeline({ paused: true }));
  const seat = useRef<Seat>(null); // `null` mean the seat is available

  const inertiaValueRef = useRef(0);
  const twInertia = useRef<gsap.core.Tween>();

  const inertiaTrackedPosRef = useRef(0);
  useEffect(() => void (inertiaTrackedPosRef.current = pos), [pos]); // copy of pos into a ref for the need of the tracker
  const trackerRef = useRef(
    VelocityTracker.track(inertiaTrackedPosRef, "current")[0] // https://gsap.com/docs/v3/Plugins/InertiaPlugin/VelocityTracker/
  );

  const damp = useCallback<Api["damp"]>(
    (end = gsap.utils.snap(1)) => {
      twInertia.current?.kill(); // cancel previous inertia tween if still active

      // https://gsap.com/docs/v3/Plugins/InertiaPlugin/
      twInertia.current = gsap.fromTo(
        inertiaValueRef,
        { current: pos }, // from
        // to
        {
          inertia: {
            current: {
              velocity: trackerRef.current.get("current"),
              end,
            },
            duration: { min: opts.duration[0], max: opts.duration[1] },
          },
          onUpdate() {
            // console.log("tick", inertiaValueRef.current);

            setPos(inertiaValueRef.current);
          },
          onComplete() {
            posTargetRef.current = inertiaValueRef.current;
          },
        }
      );
    },
    [opts.duration, pos]
  );

  const go = useCallback<Api["go"]>(
    (x, damping = true) => {
      const newPosTarget =
        typeof x === "function" ? x(posTargetRef.current) : x;

      console.log(
        "navigating from %s to %s",
        posTargetRef.current,
        newPosTarget
      );
      posTargetRef.current = newPosTarget;

      if (damping) {
        damp(() => gsap.utils.snap(1)(newPosTarget));
      } else {
        setPos(newPosTarget);
      }
    },
    [damp]
  );

  // api
  const value = useMemo(
    () => ({
      posState: [pos, setPos],
      posTargetRef,

      tlPanels,
      seat,

      inertiaValueRef,
      twInertia,
      trackerRef,

      go,
      damp,

      options: opts,
    }),
    [pos, go, damp, opts]
  ) satisfies Api;

  useImperativeHandle(ref, () => value, [value]);

  return <Provider value={value}>{children}</Provider>;
});

// ██████  ██████   █████   ██████
// ██   ██ ██   ██ ██   ██ ██
// ██   ██ ██████  ███████ ██   ███
// ██   ██ ██   ██ ██   ██ ██    ██
// ██████  ██   ██ ██   ██  ██████
//
// with inertia

type CustomDragEvent = EventTypes["drag"] & { object: THREE.Mesh }; // event.object does not exist on `EventTypes["drag"]` natively :/ (asked on: https://discord.com/channels/740090768164651008/740093202987483156/1238080861686206464)

function useDrag({
  onDrag,
}: {
  onDrag?: Parameters<typeof useGesture>[0]["onDrag"];
} = {}) {
  const {
    inertiaValueRef,
    twInertia,
    posState: [, setPos],
    posTargetRef,
    seat,
    damp,
    options,
  } = useCovrflow();

  const bind = useGesture({
    onDragStart({ event }) {
      // console.log("onDragStart");

      // Taking the seat if available
      if (seat.current !== null) return; // if not => skip
      seat.current = (event as CustomDragEvent).object;

      twInertia.current?.kill(); // Cancel previous inertia tween if still active
    },
    onDrag(...args) {
      // console.log("onDrag");

      const {
        movement: [mx],
        event,
      } = args[0];

      if (seat.current !== (event as CustomDragEvent).object) return;

      onDrag?.(...args); // callback

      posTargetRef.current = inertiaValueRef.current + mx * options.sensitivity; // Set new target value
      setPos(posTargetRef.current); // Immediately update `pos` to the target
    },
    onDragEnd({ movement: [mx], event }) {
      // console.log("onDragEnd");

      // Releasing the seat on "dragend"
      if (seat.current !== (event as CustomDragEvent).object) return;
      seat.current = null;

      // if (Math.abs(mx) <= 0) return; // prevent simple-click (without any movement)

      damp();
    },
  });

  return { bind };
}

// ██████   █████  ███    ██ ███████ ██      ███████
// ██   ██ ██   ██ ████   ██ ██      ██      ██
// ██████  ███████ ██ ██  ██ █████   ██      ███████
// ██      ██   ██ ██  ██ ██ ██      ██           ██
// ██      ██   ██ ██   ████ ███████ ███████ ███████

function Panels() {
  // console.log("Panels");

  const {
    tlPanels,
    posState: [pos],
    options,
  } = useCovrflow();

  // sync timeline with pos
  useEffect(() => {
    const t = mod(pos); // [0..1]
    tlPanels.current.seek(t, false); // 2nd param: `suppressEvents` to false to trigger `on*` callbacks (see: https://gsap.com/docs/v3/GSAP/Tween/seek()/)
  }, [pos, tlPanels]);

  //
  // Tweens
  //

  const panel1Ref = useRef<ElementRef<"mesh">>(null);
  const panel2Ref = useRef<ElementRef<"mesh">>(null);
  const panel3Ref = useRef<ElementRef<"mesh">>(null);
  const panel4Ref = useRef<ElementRef<"mesh">>(null);

  const { contextSafe } = useGSAP(() => {
    console.log("useGSAP");

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
      arr2vec(STATES.backleft.position),
      { ...arr2vec(STATES.left.position), duration, ease }
    );

    const tw1Rot = gsap.fromTo(
      panel1Ref.current.rotation,
      arr2vec(STATES.backleft.rotation),
      { ...arr2vec(STATES.left.rotation), duration, ease }
    );

    const o1 = { opacity: STATES.backleft.opacity };
    const tw1Transparency = gsap.fromTo(o1, o1, {
      opacity: STATES.left.opacity,
      duration,
      // ease: "circ.in",
      onUpdate() {
        // console.log("onUpdate", o1);
        const mat = panel1Ref.current?.material as THREE.MeshStandardMaterial;
        mat.opacity = o1.opacity;
      },
    });

    tl1.add(tw1Rot, 0);
    tl1.add(tw1Pos, 0);
    tl1.add(tw1Transparency, 0);

    //
    // 2: left -> front
    //

    const tl2 = gsap.timeline();

    const tw2Pos = gsap.fromTo(
      panel2Ref.current.position,
      arr2vec(STATES.left.position),
      { ...arr2vec(STATES.front.position), duration, ease }
    );

    const tw2Rot = gsap.fromTo(
      panel2Ref.current.rotation,
      arr2vec(STATES.left.rotation),
      { ...arr2vec(STATES.front.rotation), duration, ease }
    );

    tl2.add(tw2Rot, 0);
    tl2.add(tw2Pos, 0);

    //
    // 3: front -> right
    //

    const tl3 = gsap.timeline();

    const tw3Pos = gsap.fromTo(
      panel3Ref.current.position,
      arr2vec(STATES.front.position),
      { ...arr2vec(STATES.right.position), duration, ease }
    );

    const tw3Rot = gsap.fromTo(
      panel3Ref.current.rotation,
      arr2vec(STATES.front.rotation),
      { ...arr2vec(STATES.right.rotation), duration, ease }
    );

    tl3.add(tw3Rot, 0);
    tl3.add(tw3Pos, 0);

    //
    // 4: right -> backright
    //

    const tl4 = gsap.timeline();

    const tw4Pos = gsap.fromTo(
      panel4Ref.current.position,
      arr2vec(STATES.right.position),
      { ...arr2vec(STATES.backright.position), duration, ease }
    );

    const tw4Rot = gsap.fromTo(
      panel4Ref.current.rotation,
      arr2vec(STATES.right.rotation),
      { ...arr2vec(STATES.backright.rotation), duration, ease }
    );

    const o4 = { opacity: STATES.right.opacity };
    const tw4Transparency = gsap.fromTo(o4, o4, {
      opacity: STATES.backright.opacity,
      duration,
      // ease: "circ.in",
      onUpdate() {
        // console.log("onUpdate", o4);
        const mat = panel4Ref.current?.material as THREE.MeshStandardMaterial;
        mat.opacity = o4.opacity;
      },
    });

    tl4.add(tw4Rot, 0);
    tl4.add(tw4Pos, 0);
    tl4.add(tw4Transparency, 0);

    //
    // all
    //

    tlPanels.current.clear();
    tlPanels.current.add(tl1, 0);
    tlPanels.current.add(tl2, 0);
    tlPanels.current.add(tl3, 0);
    tlPanels.current.add(tl4, 0);
  });

  //
  // Materials
  //

  // Panels material color
  // useEffect(() => {
  //   const refs = [panel1Ref, panel2Ref, panel3Ref, panel4Ref];
  //   refs.forEach((ref, i) => {
  //     const color = circular(Math.floor(pos) - i + 2);
  //     if (color && ref.current) {
  //       const mat = ref.current.material as THREE.MeshStandardMaterial;
  //       mat.color.setHex(color);
  //     }
  //   });
  // }, [pos]);

  const posFloored = Math.floor(pos);
  const { srcs, colors } = useMemo(() => {
    function four<T>(arr: T[]) {
      return [
        circ(arr, posFloored + 2), // backleft
        circ(arr, posFloored + 1), // left
        circ(arr, posFloored + 0), // front
        circ(arr, posFloored - 1), // right
      ];
    }
    const srcs = four(films);
    // console.log("srcs", srcs);

    const colors = four(kulers);
    // console.log("colors", colors);

    return { srcs, colors };
  }, [posFloored]);

  // Determine the most "central" video
  const centralVideo = useMemo(
    () => (mod(pos) > 0.5 ? "left" : "front"),
    [pos]
  );

  const greenScreen = (
    <meshStandardMaterial
      transparent
      opacity={1}
      color="#2ac402"
      shadowSide={THREE.DoubleSide}
    />
  );

  const aspect = 9 / 16;
  const size: [number, number, number] = [3, 3 / aspect, 0.1];
  return (
    <>
      <group position={[0, size[1] / 2 + size[1] * 0.002, 0]}>
        <Panel ref={panel1Ref} state="backleft" size={size}>
          <Suspense fallback={greenScreen}>
            <Screen
              color={colors[0]}
              src={srcs[0]}
              aspect={aspect}
              transparent
              opacity={STATES.backleft.opacity}
            />
          </Suspense>
        </Panel>
        <Panel ref={panel2Ref} state="left" size={size}>
          <Suspense fallback={greenScreen}>
            <Screen
              color={colors[1]}
              src={srcs[1]}
              aspect={aspect}
              // videoTextureProps={{ start: centralVideo === "left" }}
            />
          </Suspense>
        </Panel>
        <Panel ref={panel3Ref} state="front" size={size}>
          <Suspense fallback={greenScreen}>
            <Screen
              color={colors[2]}
              src={srcs[2]}
              aspect={aspect}
              // videoTextureProps={{ start: centralVideo === "front" }}
            />
          </Suspense>
        </Panel>
        <Panel ref={panel4Ref} state="right" size={size}>
          <Suspense fallback={greenScreen}>
            <Screen
              color={colors[3]}
              src={srcs[3]}
              aspect={aspect}
              transparent
              opacity={STATES.right.opacity}
            />
          </Suspense>
        </Panel>

        <Panel state="backright" debugOnly size={size} />
      </group>

      {options.debug && <Seeker />}
    </>
  );
}

// ██████   █████  ███    ██ ███████ ██
// ██   ██ ██   ██ ████   ██ ██      ██
// ██████  ███████ ██ ██  ██ █████   ██
// ██      ██   ██ ██  ██ ██ ██      ██
// ██      ██   ██ ██   ████ ███████ ███████

function roundedRectangleGeometry(
  w: number,
  h: number,
  r: number,
  s: number = 1
) {
  // width, height, radiusCorner, smoothness

  const pi2 = Math.PI * 2;
  const n = (s + 1) * 4; // number of segments
  let indices = [];
  let positions = [];
  let uvs = [];
  let qu, sgx, sgy, x, y;

  for (let j = 1; j < n + 1; j++) indices.push(0, j, j + 1); // 0 is center
  indices.push(0, n, 1);
  positions.push(0, 0, 0); // rectangle center
  uvs.push(0.5, 0.5);
  for (let j = 0; j < n; j++) contour(j);

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(uvs), 2)
  );

  return geometry;

  function contour(j: number) {
    qu = Math.trunc((4 * j) / n) + 1; // quadrant  qu: 1..4
    sgx = qu === 1 || qu === 4 ? 1 : -1; // signum left/right
    sgy = qu < 3 ? 1 : -1; // signum  top / bottom
    x = sgx * (w / 2 - r) + r * Math.cos((pi2 * (j - qu + 1)) / (n - 4)); // corner center + circle
    y = sgy * (h / 2 - r) + r * Math.sin((pi2 * (j - qu + 1)) / (n - 4));

    positions.push(x, y, 0);
    uvs.push(0.5 + x / w, 0.5 + y / h);
  }
}

const Panel = forwardRef<
  ElementRef<"mesh">,
  ComponentProps<"mesh"> & {
    state: keyof typeof STATES;
    debug?: boolean;
    debugOnly?: boolean;
    size: [number, number, number];
    borderRadius?: number;
  }
>(
  (
    {
      state,
      children,
      debugOnly = false,
      size = [3, 5, 0.1],
      borderRadius = 0.15,
      ...props
    },
    ref
  ) => {
    // console.log("Panel");

    const {
      options: { debug },
    } = useCovrflow();

    const posRot = {
      position: STATES[state].position,
      rotation: STATES[state].rotation,
    };

    const { bind } = useDrag();

    // const roundedPlaneGeometry = useMemo(
    //   () =>
    //     new geometry.RoundedPlaneGeometry(...size.slice(0, 2), borderRadius),
    //   [size, borderRadius]
    // );
    const planeGeometry = useMemo(
      () => new THREE.PlaneGeometry(...size.slice(0, 2)),
      [size]
    );

    return (
      <>
        {!debugOnly && (
          <mesh
            ref={ref}
            castShadow
            receiveShadow
            {...posRot}
            {...props}
            {...(bind() as any)}
          >
            {/* <primitive object={roundedPlaneGeometry} /> */}
            <primitive object={planeGeometry} />
            {children}
          </mesh>
        )}

        {debug && (
          <Box args={size} {...posRot}>
            <meshStandardMaterial wireframe color="#aaa" />
          </Box>
        )}
      </>
    );
  }
);

// ███████  ██████ ██████  ███████ ███████ ███    ██
// ██      ██      ██   ██ ██      ██      ████   ██
// ███████ ██      ██████  █████   █████   ██ ██  ██
//      ██ ██      ██   ██ ██      ██      ██  ██ ██
// ███████  ██████ ██   ██ ███████ ███████ ██   ████

function Screen({
  src,
  color = "#bebebe",
  aspect,
  size = "cover",
  videoTextureProps: { start = false, preload, ...videoTextureProps } = {},
  ...props
}: {
  src: string;
  color?: ComponentProps<"meshStandardMaterial">["color"];
  aspect?: number;
  size?: "cover" | "contain";
  videoTextureProps?: Parameters<typeof useVideoTexture>[1];
} & ComponentProps<"meshStandardMaterial">) {
  const tex = useVideoTexture(src, {
    start,
    preload,
    // unsuspend: "canplaythrough",
    onloadedmetadata(e) {
      console.log("onloadedmetadata", e);

      const video = e.target as HTMLVideoElement;
      if (!video) return;

      video.currentTime = 30;
    },
    ...videoTextureProps,
  });

  // setTexture?.(tex);

  const video = tex.image as HTMLVideoElement;

  useEffect(() => {
    if (video) {
      if (start) {
        video.play();
      } else {
        video.pause();
      }
    }
  }, [start, video]);

  useEffect(() => {
    if (video && aspect) {
      const r = video.videoWidth / video.videoHeight;
      const R = aspect;

      const { repeat, offset } = objectFit(r, R, size);
      tex.repeat.copy(repeat);
      tex.offset.copy(offset);
    }
  }, [aspect, size, tex, video]);

  let map;
  map = tex;

  return (
    <meshStandardMaterial
      color={map ? undefined : color}
      map={map}
      {...props}
      side={THREE.DoubleSide}
      //
    />
  );
}

// ███████ ███████ ███████ ██   ██ ███████ ██████
// ██      ██      ██      ██  ██  ██      ██   ██
// ███████ █████   █████   █████   █████   ██████
//      ██ ██      ██      ██  ██  ██      ██   ██
// ███████ ███████ ███████ ██   ██ ███████ ██   ██

function Seeker({ ...props }: ComponentProps<"mesh"> & {}) {
  const [springs, api] = useSpring(() => ({ position: [0, 0, 0] })); // https://codesandbox.io/p/sandbox/react-three-fiber-gestures-fig3s
  const { bind } = useDrag({
    onDrag: ({ down, movement: [mx] }) => {
      api.start({ position: down ? [mx / 200, 0, 0] : [0, 0, 0] });
    },
  });

  const cursorColor1 = { normal: "#f472b6", hover: "#ec4899" };
  const [color1, setColor1] = useState(cursorColor1.normal);

  const a = 0.25;
  return (
    <animated.mesh
      {...(bind() as any)}
      {...props}
      castShadow
      receiveShadow
      position={springs.position.to((x, y, z) => [x, a / 2, 11])}
      onPointerEnter={() => setColor1(cursorColor1.hover)}
      onPointerLeave={() => setColor1(cursorColor1.normal)}
    >
      {/* <boxGeometry args={[1.25 * a, a, a]} /> */}
      <sphereGeometry args={[a / 2, 64, 64]} />
      <meshStandardMaterial color={color1} />
    </animated.mesh>
  );
}
