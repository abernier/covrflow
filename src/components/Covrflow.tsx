import * as THREE from "three";
import {
  ComponentProps,
  ElementRef,
  MutableRefObject,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  Dispatch,
  SetStateAction,
  useMemo,
  useImperativeHandle,
} from "react";
import { Box } from "@react-three/drei";
import { useControls } from "leva";
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

gsap.registerPlugin(InertiaPlugin);

const useGesture = createUseGesture([dragAction, pinchAction]);

//
// Utilities
//

function circular(i: number) {
  return content.at(
    (i + (Math.floor(content.length / 2) - 1)) % content.length
  );
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

//
// Constants
//

const content = [
  "#ecfdf5",
  "#d1fae5",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981",
  "#059669",
  "#047857",
  "#065f46",
  "#064e3b",
  "#022c22",
].reverse();

const r = 5;
const STATES = {
  backleft: {
    position: [
      -2 * r * Math.cos(Math.PI / 3),
      0,
      -1.5 * r * Math.sin(Math.PI / 3),
    ],
    rotation: [0, Math.PI / 3, 0],
    opacity: 0,
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
    opacity: 0,
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

type PosState = [number, Dispatch<SetStateAction<number>>];

const defaultOptions = {
  sensitivity: 1 / 200,
  duration: [0.5, 1.5] as [number, number],
  debug: false,
};
type Options = Partial<typeof defaultOptions>;

export const Covrflow = forwardRef<
  ElementRef<typeof Inertia>,
  {
    posState?: PosState;
    options?: Options;
  } & ComponentProps<"group">
>(({ posState: externalPosState, options, ...props }, ref) => {
  let internalPosState = useState(0);
  const posState = externalPosState || internalPosState;

  return (
    <group {...props}>
      <Inertia ref={ref} posState={posState} options={options}>
        <Panels />
      </Inertia>
    </group>
  );
});

// ██████  ██████   ██████  ██    ██ ██ ██████  ███████ ██████
// ██   ██ ██   ██ ██    ██ ██    ██ ██ ██   ██ ██      ██   ██
// ██████  ██████  ██    ██ ██    ██ ██ ██   ██ █████   ██████
// ██      ██   ██ ██    ██  ██  ██  ██ ██   ██ ██      ██   ██
// ██      ██   ██  ██████    ████   ██ ██████  ███████ ██   ██

type Seat = THREE.Mesh | null;

const [useCovrflow, Provider] = createRequiredContext<{
  total: MutableRefObject<number>;
  obj: MutableRefObject<number>;
  tlPanels: gsap.core.Timeline;
  twInertia: MutableRefObject<gsap.core.Tween | undefined>;
  tracker: gsap.VelocityTrackerInstance;
  posState: PosState;
  seat: MutableRefObject<Seat>;
  go: (pos: number) => void;
  feather: (val: number, end?: gsap.InertiaObject["end"]) => void;
  options: Options;
}>();

export const Inertia = forwardRef<
  ReturnType<typeof useCovrflow>,
  {
    children: React.ReactNode;
    posState?: PosState;
    options?: Options;
  }
>(({ children, posState: externalPosState, options = {} }, ref) => {
  const opts = merge(options, defaultOptions);

  let internalPosState = useState(0);
  const posState = externalPosState || internalPosState;
  const [pos, setPos] = posState;

  const seat = useRef<Seat>(null); // `null` mean the seat is available

  const [tlPanels] = useState(gsap.timeline({ paused: true }));

  const total = useRef(0);
  const obj = useRef(0);
  const twInertia = useRef<gsap.core.Tween>();
  const [tracker] = useState(
    VelocityTracker.track(obj, "current")[0] // https://gsap.com/docs/v3/Plugins/InertiaPlugin/VelocityTracker/
  );

  const feather = useCallback(
    (val: number, end: gsap.InertiaObject["end"] = gsap.utils.snap(1)) => {
      total.current = val; // Important: update `total` when dragging ends
      // https://gsap.com/docs/v3/Plugins/InertiaPlugin/
      twInertia.current = gsap.to(total, {
        inertia: {
          current: {
            velocity: tracker.get("current"),
            end,
          },
          duration: { min: opts.duration[0], max: opts.duration[1] },
        },
        onUpdate() {
          // console.log("tick");
          setPos(total.current);
        },
      });
    },
    [opts.duration, setPos, tracker]
  );

  const value = useMemo(
    () => ({
      total,
      obj,
      tlPanels,
      twInertia,
      tracker,
      posState,
      seat,
      go(val: number) {
        console.log("go from %s to %s", pos, val);
        twInertia.current?.kill(); // cancel previous inertia tween if still active
        feather(pos, (n) => gsap.utils.snap(1)(val));
      },
      feather,
      options,
    }),
    [tlPanels, tracker, posState, feather, options, pos]
  );

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
  sensitivity = 1 / 200,
  onDrag,
  duration: [durMin, durMax] = [0.5, 1.5],
}: {
  sensitivity?: number;
  onDrag?: Parameters<typeof useGesture>[0]["onDrag"];
  duration?: [number, number];
} = {}) {
  const { total, obj, twInertia, posState, seat, feather } = useCovrflow();
  let [pos, setPos] = posState;

  const bind = useGesture({
    onDragStart({ event }) {
      // console.log("onDragStart");

      // Taking the seat if available
      if (seat.current !== null) return; // if not => skip
      seat.current = (event as CustomDragEvent).object;

      twInertia.current?.kill(); // cancel previous inertia tween if still active
      total.current = pos; // Important: update `total` when dragging starts
    },
    onDrag(...args) {
      // console.log("onDrag");

      const {
        movement: [mx],
        event,
      } = args[0];

      if (seat.current !== (event as CustomDragEvent).object) return;

      onDrag?.(...args); // callback

      obj.current = total.current + mx * sensitivity;
      setPos(obj.current);
    },
    onDragEnd(...args) {
      // console.log("onDragEnd");

      const {
        movement: [mx],
        event,
      } = args[0];

      // Releasing the seat on "dragend"
      if (seat.current !== (event as CustomDragEvent).object) return;
      seat.current = null;

      if (Math.abs(mx) <= 0) return; // prevent simple-click (without any movement)

      feather(obj.current);
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
  //
  // Tweens
  //

  const { tlPanels: tl, posState, options } = useCovrflow();

  const panel1Ref = useRef<ElementRef<typeof Box>>(null);
  const panel2Ref = useRef<ElementRef<typeof Box>>(null);
  const panel3Ref = useRef<ElementRef<typeof Box>>(null);
  const panel4Ref = useRef<ElementRef<typeof Box>>(null);

  const { contextSafe } = useGSAP(() => {
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
    const tw1Transparency = gsap.fromTo(
      panel1Ref.current.material,
      { opacity: STATES.backleft.opacity, transparent: true },
      {
        opacity: STATES.left.opacity,
        transparent: true,
        duration,
        // ease: "circ.in",
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
    const tw4Transparency = gsap.fromTo(
      panel4Ref.current.material,
      { opacity: STATES.right.opacity, transparent: true },
      {
        opacity: STATES.backright.opacity,
        transparent: true,
        duration,
        // ease: "circ.in",
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
  });

  //
  // GUI
  //

  const [pos, setPos] = posState;

  useEffect(() => {
    tl.seek(mod(pos)); // seek [0..1]
  }, [pos, tl]);

  //
  //
  //

  const size: [number, number, number] = [3, 5, 0.1];
  return (
    <>
      <group position={[0, size[1] / 2 + 0.01, 0]}>
        <Panel
          name="backleft"
          ref={panel1Ref}
          state="backleft"
          debug={options.debug}
          size={size}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 0 + 2)} />
        </Panel>
        <Panel
          name="left"
          ref={panel2Ref}
          state="left"
          debug={options.debug}
          size={size}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 1 + 2)} />
        </Panel>
        <Panel
          name="front"
          ref={panel3Ref}
          state="front"
          debug={options.debug}
          size={size}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 2 + 2)} />
        </Panel>
        <Panel
          name="right"
          ref={panel4Ref}
          state="right"
          debug={options.debug}
          size={size}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 3 + 2)} />
        </Panel>

        <Panel
          name="backright"
          state="backright"
          debug={options.debug}
          debugOnly
          size={size}
        />
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

const Panel = forwardRef<
  ElementRef<typeof Box>,
  ComponentProps<typeof Box> & {
    state: keyof typeof STATES;
    debug?: boolean;
    debugOnly?: boolean;
    size?: [number, number, number];
  }
>(
  (
    { state, children, debug, debugOnly = false, size = [3, 5, 0.1], ...props },
    ref
  ) => {
    const posRot = {
      position: STATES[state].position,
      rotation: STATES[state].rotation,
    };

    const {
      options: { sensitivity, duration },
    } = useCovrflow();

    const { bind } = useDrag({ sensitivity, duration });

    // const [_pointer] = useState(new Vector2());
    // const [_event] = useState({ type: "", data: _pointer });

    // const dragging = useRef(false);

    return (
      <>
        {!debugOnly && (
          // <Interactive
          //   onSelectStart={(e) => {
          //     console.log("onSelectStart", e);

          //     dragging.current = true;

          //     if (!e.intersection?.uv) return;

          //     const uv = e.intersection?.uv;
          //     const object = e.intersection?.object;

          //     _event.type = "mousedown";
          //     _event.data.set(uv.x, 1 - uv.y);

          //     const clientX = uv.x * window.innerWidth;
          //     const clientY = uv.y * window.innerHeight;

          //     object.dispatchEvent(
          //       new PointerEvent("pointerdown", { clientX, clientY })
          //     );
          //   }}
          //   onSelectEnd={(e) => {
          //     console.log("onSelectEnd", e);

          //     dragging.current = false;

          //     if (!e.intersection?.uv) return;

          //     const uv = e.intersection?.uv;
          //     const object = e.intersection?.object;

          //     // _event.type = "mouseup";
          //     // _event.data.set(uv.x, 1 - uv.y);
          //     // object.dispatchEvent(_event);

          //     const clientX = uv.x * window.innerWidth;
          //     const clientY = uv.y * window.innerHeight;
          //     object.dispatchEvent(
          //       new PointerEvent("pointerup", { clientX, clientY })
          //     );
          //   }}
          //   onMove={(e) => {
          //     if (dragging.current !== true) return; // skip if not dragging
          //     console.log("onMove", e);

          //     if (!e.intersection?.uv) return;

          //     const uv = e.intersection?.uv;
          //     const object = e.intersection?.object;

          //     // _event.type = "mousemove";
          //     // _event.data.set(uv.x, 1 - uv.y);
          //     // object.dispatchEvent(_event);

          //     const clientX = uv.x * window.innerWidth;
          //     const clientY = uv.y * window.innerHeight;
          //     console.log(clientX, clientY);
          //     object.dispatchEvent(
          //       new PointerEvent("pointermove", { clientX, clientY })
          //     );
          //   }}
          // >
          <Box
            args={size}
            ref={ref}
            castShadow
            receiveShadow
            {...posRot}
            {...props}
            {...(bind() as any)}
          >
            {children || (
              <meshStandardMaterial transparent opacity={1} color="white" />
            )}
          </Box>
          // </Interactive>
        )}

        {debug && (
          <Box args={size} {...posRot} {...props}>
            <meshStandardMaterial wireframe color="#aaa" />
          </Box>
        )}
      </>
    );
  }
);

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
