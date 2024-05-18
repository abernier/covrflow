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

export const Covrflow = forwardRef<
  ElementRef<"group">,
  ComponentProps<"group">
>((props, ref) => {
  return (
    <group ref={ref} {...props}>
      <Inertia>
        <Panels />
      </Inertia>
    </group>
  );
});

// ██ ███    ██ ███████ ██████  ████████ ██  █████
// ██ ████   ██ ██      ██   ██    ██    ██ ██   ██
// ██ ██ ██  ██ █████   ██████     ██    ██ ███████
// ██ ██  ██ ██ ██      ██   ██    ██    ██ ██   ██
// ██ ██   ████ ███████ ██   ██    ██    ██ ██   ██

type Seat = THREE.Mesh | null;

const [useInertia, InertiaProvider] = createRequiredContext<{
  total: MutableRefObject<number>;
  obj: MutableRefObject<number>;
  twInertia: MutableRefObject<gsap.core.Tween | undefined>;
  tracker: gsap.VelocityTrackerInstance;
  state: [number, Dispatch<SetStateAction<number>>];
  seat: MutableRefObject<Seat>;
}>();

export function Inertia({ ...props }) {
  const total = useRef(0);
  const obj = useRef(0);
  const twInertia = useRef<gsap.core.Tween>();

  const seat = useRef<Seat>(null); // `null` mean the seat is available

  const tracker = VelocityTracker.track(obj, "current")[0]; // https://gsap.com/docs/v3/Plugins/InertiaPlugin/VelocityTracker/

  const state = useState(0);

  return (
    <InertiaProvider
      value={{ total, obj, twInertia, tracker, state, seat }}
      {...props}
    />
  );
}

type CustomDragEvent = EventTypes["drag"] & { object: THREE.Mesh }; // event.object does not exist on `EventTypes["drag"]` natively :/ (asked on: https://discord.com/channels/740090768164651008/740093202987483156/1238080861686206464)

function useInertiaDrag({
  sensitivity = 1 / 200,
  onDrag,
  duration: [durMin, durMax] = [0.5, 1.5],
}: {
  sensitivity?: number;
  onDrag?: Parameters<typeof useGesture>[0]["onDrag"];
  duration?: [number, number];
} = {}) {
  const { total, obj, twInertia, tracker, state, seat } = useInertia();
  const [, set] = state; // Final value

  const bind = useGesture({
    onDragStart({ event }) {
      // console.log("onDragStart");

      // Taking the seat if available
      if (seat.current !== null) return; // if not => skip
      seat.current = (event as CustomDragEvent).object;

      twInertia.current?.kill(); // cancel previous inertia tween if still active
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
      set(obj.current);
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

      const velocity = tracker.get("current");

      total.current = obj.current; // Important: update `total` when dragging ends

      // https://gsap.com/docs/v3/Plugins/InertiaPlugin/
      twInertia.current = gsap.to(total, {
        inertia: {
          current: {
            velocity,
            end: gsap.utils.snap(1),
          },
          duration: { min: durMin, max: durMax },
        },
        onUpdate() {
          // console.log("tick");
          set(total.current);
        },
      });
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

  const [tl] = useState(gsap.timeline({ paused: true }));

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

  const [gui, setGui] = useControls(() => ({
    pos: 0,
    debug: false,
  }));

  const pos = gui.pos;
  const setPos = useCallback((pos: number) => setGui({ pos }), [setGui]);

  useEffect(() => {
    tl.seek(mod(pos)); // seek [0..1] once `pos` changes
  }, [tl, pos]);

  //
  // prev/next
  //

  // const twPrevNext = useRef<gsap.core.Tween>();

  // const prevNextHandler = useCallback(
  //   (direction: "next" | "prev") => {
  //     const dir = direction === "prev" ? -1 : 1;

  //     return contextSafe(() => {
  //       twPrevNext.current?.kill();

  //       const o = { val: gui.pos };
  //       twPrevNext.current = gsap.to(o, {
  //         val: Math.floor(gui.pos) + 1 * dir,
  //         onUpdate: () => setPos(o.val),
  //       });
  //     });
  //   },
  //   [contextSafe, gui.pos, setPos]
  // );

  //
  //
  //

  const {
    state: [value],
  } = useInertia();

  useEffect(() => {
    setPos(value); // sync gui.pos with inertia value
  }, [setPos, value]);

  const debug = gui.debug;

  const size: [number, number, number] = [3, 5, 0.1];
  return (
    <>
      <group position={[0, size[1] / 2 + 0.01, 0]}>
        <Panel
          name="backleft"
          ref={panel1Ref}
          state="backleft"
          debug={debug}
          size={size}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 0 + 2)} />
        </Panel>
        <Panel
          name="left"
          ref={panel2Ref}
          state="left"
          debug={debug}
          size={size}
          // onPointerUp={prevNextHandler("prev")}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 1 + 2)} />
        </Panel>
        <Panel
          name="front"
          ref={panel3Ref}
          state="front"
          debug={debug}
          size={size}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 2 + 2)} />
        </Panel>
        <Panel
          name="right"
          ref={panel4Ref}
          state="right"
          debug={debug}
          size={size}
          // onPointerUp={prevNextHandler("next")}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 3 + 2)} />
        </Panel>

        <Panel
          name="backright"
          state="backright"
          debug={debug}
          debugOnly
          size={size}
        />
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

    const { sensitivity, duration } = useControls({
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
    });

    const { bind } = useInertiaDrag({ sensitivity, duration });

    return (
      <>
        {!debugOnly && (
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
  const { bind } = useInertiaDrag({
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
