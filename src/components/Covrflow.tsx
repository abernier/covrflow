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
  ReactNode,
} from "react";
import { Box, Sphere, useVideoTexture } from "@react-three/drei";

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
import merge from "deepmerge";
import { invalidate, useFrame } from "@react-three/fiber";
import * as geometry from "maath/geometry";
import { suspend, peek } from "suspend-react";

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

const useSmoothValue = (period = 1000) => {
  type Value = {
    value: number;
    timestamp: number;
  };

  const valuesRef = useRef<Value[]>([]);

  const add = (value: number, timestamp = performance.now()) => {
    const o = {
      value,
      timestamp, // remember a timestamp for each value
    } satisfies Value;

    valuesRef.current.push(o);

    return compute.bind(this, timestamp);
  };

  const compute = useCallback(
    (now = performance.now()) => {
      // Remove objects older than the period
      const cutoffTime = now - period;
      while (
        valuesRef.current.length > 0 &&
        valuesRef.current[0].timestamp < cutoffTime
      ) {
        valuesRef.current.shift();
      }

      // Calculate the average of the values in the queue
      const sum = valuesRef.current.reduce((acc, { value }) => acc + value, 0);
      const smoothedValue =
        valuesRef.current.length > 0 ? sum / valuesRef.current.length : 0;

      return smoothedValue;
    },
    [period]
  );

  return [add, compute] as const;
};

//
// Constants
//

export type Media = {
  color: THREE.Color | string;
  image: string;
  video: string;
};
export type Medias = Media[];

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
  duration: [0.5, 1.5],
  start: true,
  startIfVelocityLowerThan: 1, // It won't start if velocity is greater than this value
  mode: undefined,
  debug: false,
};
type Options = {
  sensitivity: number;
  duration: [number, number];
  start?: boolean;
  startIfVelocityLowerThan?: number;
  mode?: keyof Media;
  debug: boolean;
};

export const Covrflow = forwardRef<
  ElementRef<typeof CovrflowProvider>,
  {
    children: ReactNode;
    medias?: Medias;
    options?: Options;
  } & ComponentProps<"group">
>(({ children, medias, options, ...props }, ref) => {
  return (
    <group {...props}>
      <CovrflowProvider ref={ref} medias={medias} options={options}>
        <Panels />
        {children}
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

  draggingState: [boolean, Dispatch<SetStateAction<boolean>>];

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

  medias?: Medias;
  options: Options;
};

const [useCovrflow, Provider] = createRequiredContext<Api>();
export { useCovrflow };

export const CovrflowProvider = forwardRef<
  Api,
  {
    children: React.ReactNode;
    options?: Partial<Options>;
    medias?: Medias;
  }
>(({ children, medias, options = {} }, ref) => {
  // console.log("CovrflowProvider");

  const opts = merge(defaultOptions, options, {
    arrayMerge: (dstArr, srcArr, options) => srcArr, // do not concat arrays (see: https://www.npmjs.com/package/deepmerge#arraymerge-example-overwrite-target-array)
  });

  const [pos, setPos] = useState(0);
  const posTargetRef = useRef(0);

  const [dragging, setDragging] = useState(false);

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
            setDragging(false);
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
        setDragging(true);
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

      draggingState: [dragging, setDragging],

      tlPanels,
      seat,

      inertiaValueRef,
      twInertia,
      trackerRef,

      go,
      damp,

      medias,
      options: opts,
    }),
    [pos, dragging, go, damp, medias, opts]
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
    draggingState: [, setDragging],
    seat,
    damp,
    options,
  } = useCovrflow();

  const bind = useGesture({
    onDragStart({ event }) {
      // console.log("onDragStart");

      setDragging(true);

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

      setDragging(false);
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
    draggingState: [dragging],
    trackerRef,
    options: { debug, start, startIfVelocityLowerThan },
    medias,
  } = useCovrflow();

  // console.log("medias=", medias);

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
  // fourMedias
  //

  const posFloored = Math.floor(pos);
  const fourMedias = useMemo(() => {
    if (!medias) return [undefined, undefined, undefined, undefined];

    return [
      circ(medias, posFloored + 2, false), // backleft
      circ(medias, posFloored + 1, false), // left
      circ(medias, posFloored + 0, false), // front
      circ(medias, posFloored - 1, false), // right
    ];
  }, [medias, posFloored]);

  //
  // dynamic quality (based on smoothed velocity)
  //

  const [add] = useSmoothValue(100);

  const [quality, setQuality] =
    useState<ComponentProps<typeof Screen>["quality"]>("best-in-class");
  useFrame(() => {
    let velocity = trackerRef.current.get("current");
    // console.log("velocity=", velocity);
    if (isNaN(velocity)) velocity = 0;

    const smoothedVelocity = add(velocity + (dragging ? 0.1 : 0))(); // if dragging: never go 0 (even if still)! so when releasing, quality is not suddenly "highest", but has to smooth to 0
    // console.log("smoothedVelocity", smoothedVelocity);

    // const v = Math.abs(velocity);
    // const motionless = v === 0
    const v = Math.abs(smoothedVelocity);
    const motionless = v === 0;

    const q = motionless && !dragging ? undefined : "best-in-class"; // undefined means "auto", ie: as `mode` is requesting
    console.log("quality", q);
    setQuality(q);
  });

  //
  // Determine the most "central" video
  //

  const centralVideo = useMemo(
    () => (mod(pos) > 0.5 ? "left" : "front"),
    [pos]
  );

  //
  // render
  //

  const aspect = 9 / 16;
  const size: [number, number, number] = [3, 3 / aspect, 0.1];

  const slowEnough =
    Math.abs(trackerRef.current.get("current")) <=
    (startIfVelocityLowerThan ?? Infinity);

  return (
    <>
      <group position={[0, size[1] / 2 + size[1] * 0.002, 0]}>
        <Panel ref={panel1Ref} state="backleft" size={size}>
          <Screen
            media={fourMedias[0]}
            aspect={aspect}
            transparent
            opacity={STATES.backleft.opacity}
            quality={quality}
            spinner={false}
          />
        </Panel>
        <Panel ref={panel2Ref} state="left" size={size}>
          <Screen
            media={fourMedias[1]}
            aspect={aspect}
            quality={quality}
            start={centralVideo === "left" && start && slowEnough}
          />
        </Panel>
        <Panel ref={panel3Ref} state="front" size={size}>
          <Screen
            media={fourMedias[2]}
            aspect={aspect}
            quality={quality}
            start={centralVideo === "front" && start && slowEnough}
          />
        </Panel>
        <Panel ref={panel4Ref} state="right" size={size}>
          <Screen
            media={fourMedias[3]}
            aspect={aspect}
            transparent
            opacity={STATES.right.opacity}
            quality={quality}
          />
        </Panel>

        <Panel state="backright" debugOnly size={size} />
      </group>

      {debug && <Seeker />}
    </>
  );
}

// ██████   █████  ███    ██ ███████ ██
// ██   ██ ██   ██ ████   ██ ██      ██
// ██████  ███████ ██ ██  ██ █████   ██
// ██      ██   ██ ██  ██ ██ ██      ██
// ██      ██   ██ ██   ████ ███████ ███████

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

    const roundedPlaneGeometry = useMemo(
      () =>
        new geometry.RoundedPlaneGeometry(...size.slice(0, 2), borderRadius),
      [size, borderRadius]
    );
    // const planeGeometry = useMemo(
    //   () => new THREE.PlaneGeometry(...size.slice(0, 2)),
    //   [size]
    // );

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
            <primitive object={roundedPlaneGeometry} />
            {/* <primitive object={planeGeometry} /> */}
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

function Spinner({
  Shape = Box,
  color = "hotpink",
}: {
  Shape?: typeof Box | typeof Sphere;
  color?: ComponentProps<"meshStandardMaterial">["color"];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.z += 0.1;
    }
  });

  const a = 0.2;

  return (
    <Shape args={Shape === Box ? [a, a, 0.01] : [a / 2, 8, 8]} ref={meshRef}>
      <meshStandardMaterial color={color} wireframe />
    </Shape>
  );
}

function Screen({
  media,
  aspect,
  quality = undefined,
  mode = "video",
  start = false,
  spinner = true,
  ...props
}: {
  media?: Media;
  aspect?: number;
  quality?: "best-in-class";
  mode?: keyof Media; // "image" | "video" | "color";
  start?: boolean;
  spinner?: boolean;
} & ComponentProps<"meshStandardMaterial">) {
  // console.log("Screen");

  const { options } = useCovrflow();

  //
  // Best in class `mode`
  //
  // 1. by default, mode is as requested ("video" or "image" or "color")
  // 2. but if quality is "best-in-class", mode degrades to "color" (or higher values, if already loaded)
  //

  let _mode = options.mode ?? mode; // 1. `_mode` is set "as requested" (by default)
  if (media) {
    if (quality === "best-in-class") {
      const imageLoaded = !!peek([media.image]);
      const videoLoaded = !!peek([media.video]);

      switch (_mode) {
        case "video":
          _mode = videoLoaded ? "video" : imageLoaded ? "image" : "color"; // 2.
          break;
        case "image":
          _mode = imageLoaded ? "image" : "color"; // 2.
          break;
        case "color":
          _mode = "color";
          break;
      }
    } else {
      // undefined => leave as 1. (as requested: "video" or "image" or "color")
    }
  } else {
    _mode = "color";
  }

  const commonProps = { side: THREE.DoubleSide, ...props };
  const imageVideoProps = { aspect };

  //
  // color < image < video (cascade)
  //

  const color = (
    <ColorMaterial color={media?.color ?? "gray"} {...commonProps} />
  );
  const image = (
    <Suspense
      fallback={
        <>
          {spinner && <Spinner color="orange" />}
          {color}
        </>
      }
    >
      {media && (
        <ImageMaterial
          src={media.image}
          {...commonProps}
          {...imageVideoProps}
        />
      )}
    </Suspense>
  );
  const video = (
    <Suspense
      fallback={
        <>
          {spinner && <Spinner color="red" />}
          {image}
        </>
      }
    >
      {media && (
        <VideoMaterial
          src={media.video}
          {...commonProps}
          {...imageVideoProps}
          videoTextureProps={{
            start,
            preload: "metadata",
            unsuspend: "canplay",
          }}
        />
      )}
    </Suspense>
  );

  return {
    color,
    image,
    video,
  }[_mode];
}

function ColorMaterial({
  color,
  ...props
}: ComponentProps<"meshStandardMaterial">) {
  return <meshStandardMaterial color={color} {...props} />;
}

const useImageTexture = (src: string) => {
  const texture = suspend(
    () =>
      new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
          src,
          (texture) => setTimeout(() => resolve(texture), 0),
          undefined,
          reject
        );
      }),
    [src]
  ) as THREE.Texture;

  return texture;
};

function ImageMaterial({
  src,
  aspect,
  size = "cover",
  ...props
}: {
  src: string;
  aspect?: number;
  size?: "cover" | "contain";
} & ComponentProps<"meshStandardMaterial">) {
  // console.log("ImageMaterial", src);

  const imageTexture = useImageTexture(src);

  const image = imageTexture.image as HTMLImageElement;

  useEffect(() => {
    return () => void imageTexture.dispose();
  }, [imageTexture]);

  useEffect(() => {
    if (image && aspect) {
      const r = image.naturalWidth / image.naturalHeight;
      const R = aspect;

      const { repeat, offset } = objectFit(r, R, size);
      imageTexture.repeat.copy(repeat);
      imageTexture.offset.copy(offset);
    }
  }, [aspect, size, image, imageTexture]);

  return <meshStandardMaterial map={imageTexture} {...props} />;
}

function VideoMaterial({
  src,
  videoTextureProps: {
    start = false,
    // unsuspend = "canplay",
    ...videoTextureProps
  } = {},
  aspect,
  size = "cover",
  ...props
}: {
  src: Parameters<typeof useVideoTexture>[0];
  videoTextureProps?: Parameters<typeof useVideoTexture>[1];
  aspect?: number;
  size?: "cover" | "contain";
} & ComponentProps<"meshStandardMaterial">) {
  // console.log("VideoMaterial", src);

  const videoTexture = useVideoTexture(src, {
    start,
    // unsuspend,
    onloadedmetadata(e) {
      // console.log("onloadedmetadata", e);

      const video = e.target as HTMLVideoElement;
      if (!video) return;

      video.currentTime = 30;
    },
    ...videoTextureProps,
  });

  useEffect(() => {
    return () => void videoTexture.dispose();
  }, [videoTexture]);

  const video = videoTexture.image as HTMLVideoElement;

  useEffect(() => {
    // console.log("useEffect1");
    if (video) {
      if (start) {
        video.play();
      } else {
        video.pause();
      }
    }
  }, [start, video]);

  useEffect(() => {
    // console.log("useEffect2");
    if (video && aspect) {
      const r = video.videoWidth / video.videoHeight;
      const R = aspect;

      const { repeat, offset } = objectFit(r, R, size);
      videoTexture.repeat.copy(repeat);
      videoTexture.offset.copy(offset);
    }
  }, [aspect, size, videoTexture, video]);

  return <meshStandardMaterial map={videoTexture} {...props} />;
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
