import {
  ComponentProps,
  ElementRef,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Box } from "@react-three/drei";
import { useControls } from "leva";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { createUseGesture, dragAction, pinchAction } from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/three";

import { InertiaPlugin, VelocityTracker } from "gsap/InertiaPlugin";

gsap.registerPlugin(InertiaPlugin);

const useGesture = createUseGesture([dragAction, pinchAction]);

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

  const debug = gui.debug;
  return (
    <>
      <group position={[0, 2.5 + 0.01, 0]}>
        <Panel ref={panel1Ref} state="backleft" debug={debug}>
          <meshStandardMaterial color={circular(Math.floor(pos) - 0 + 2)} />
        </Panel>
        <Panel
          ref={panel2Ref}
          state="left"
          debug={debug}
          // onPointerUp={prevNextHandler("prev")}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 1 + 2)} />
        </Panel>
        <Panel ref={panel3Ref} state="front" debug={debug}>
          <meshStandardMaterial color={circular(Math.floor(pos) - 2 + 2)} />
        </Panel>
        <Panel
          ref={panel4Ref}
          state="right"
          debug={debug}
          // onPointerUp={prevNextHandler("next")}
        >
          <meshStandardMaterial color={circular(Math.floor(pos) - 3 + 2)} />
        </Panel>

        <Panel state="backright" debug={debug} debugOnly />
      </group>

      <Seeker onUpdate={setPos} />
    </>
  );
});

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
  }
>(({ state, children, debug, debugOnly = false, ...props }, ref) => {
  const posRot = {
    position: STATES[state].position,
    rotation: STATES[state].rotation,
  };

  const size: [number, number, number] = [3, 5, 0.1];

  return (
    <>
      {!debugOnly && (
        <Box
          castShadow
          args={size}
          ref={ref}
          {...posRot}
          {...props}
          receiveShadow
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
});

// ███████ ███████ ███████ ██   ██ ███████ ██████
// ██      ██      ██      ██  ██  ██      ██   ██
// ███████ █████   █████   █████   █████   ██████
//      ██ ██      ██      ██  ██  ██      ██   ██
// ███████ ███████ ███████ ██   ██ ███████ ██   ██

function useDragInertia({
  sensitivity = 1 / 50,
  onDrag,
}: {
  sensitivity?: number;
  onDrag?: Parameters<typeof useGesture>[0]["onDrag"];
} = {}) {
  const [total] = useState({ x: 0 });
  const [current] = useState({ x: 0 });
  const tracker = VelocityTracker.track(current, "x")[0]; // https://gsap.com/docs/v3/Plugins/InertiaPlugin/VelocityTracker/

  const twInertia = useRef<gsap.core.Tween>();

  // Final value
  const [value, setValue] = useState(0);

  const bind = useGesture({
    onDragStart(...args) {
      twInertia.current?.kill(); // cancel previous inertia tween if still active
    },
    onDrag(...args) {
      onDrag?.(...args); // callback

      const {
        movement: [mx],
      } = args[0];

      current.x = total.x + mx * sensitivity;
      setValue(current.x);
    },
    onDragEnd({ movement: [mx] }) {
      if (Math.abs(mx) <= 0) return; // prevent simple-click (without any movement)

      total.x = current.x; // update offset when dragging ends

      // https://gsap.com/docs/v3/Plugins/InertiaPlugin/
      twInertia.current = gsap.to(total, {
        inertia: {
          x: {
            velocity: tracker.get("x"),
            end: gsap.utils.snap(1),
          },
          duration: { min: 0.5, max: 1.5 },
        },
        onUpdate() {
          setValue(total.x);
        },
      });
    },
  });

  return { bind, value };
}

function Seeker({
  onUpdate,
  ...props
}: Omit<ComponentProps<"mesh">, "onUpdate"> & {
  onUpdate?: (val: number) => void;
}) {
  const [springs1, api1] = useSpring(() => ({ position: [0, 0, 0] })); // https://codesandbox.io/p/sandbox/react-three-fiber-gestures-fig3s
  const { bind: bind1, value: value1 } = useDragInertia({
    onDrag: ({ down, movement: [mx] }) => {
      api1.start({ position: down ? [mx / 200, 0, 0] : [0, 0, 0] });
    },
  });
  useEffect(() => {
    onUpdate?.(value1);
  }, [onUpdate, value1]);

  const [springs2, api2] = useSpring(() => ({ position: [0, 0, 0] })); // https://codesandbox.io/p/sandbox/react-three-fiber-gestures-fig3s
  const { bind: bind2, value: value2 } = useDragInertia({
    onDrag: ({ down, movement: [mx] }) => {
      api2.start({ position: down ? [mx / 200, 0, 0] : [0, 0, 0] });
    },
  });
  useEffect(() => {
    onUpdate?.(value2);
  }, [onUpdate, value2]);

  const cursorColor1 = { normal: "#f472b6", hover: "#ec4899" };
  const [color1, setColor1] = useState(cursorColor1.normal);

  const cursorColor2 = { normal: "#c084fc", hover: "#a855f7" };
  const [color2, setColor2] = useState(cursorColor2.normal);
  const a = 0.25;
  return (
    <>
      <animated.mesh
        {...(bind1() as any)}
        {...props}
        castShadow
        receiveShadow
        position={springs1.position.to((x, y, z) => [x, a / 2, 11])}
        onPointerEnter={() => setColor1(cursorColor1.hover)}
        onPointerLeave={() => setColor1(cursorColor1.normal)}
      >
        {/* <boxGeometry args={[1.25 * a, a, a]} /> */}
        <sphereGeometry args={[a / 2, 64, 64]} />
        <meshStandardMaterial color={color1} />
      </animated.mesh>

      <animated.mesh
        {...(bind2() as any)}
        {...props}
        castShadow
        receiveShadow
        position={springs2.position.to((x, y, z) => [x, a / 2, 12])}
        onPointerEnter={() => setColor2(cursorColor2.hover)}
        onPointerLeave={() => setColor2(cursorColor2.normal)}
      >
        {/* <boxGeometry args={[1.25 * a, a, a]} /> */}
        <sphereGeometry args={[a / 2, 64, 64]} />
        <meshStandardMaterial color={color2} />
      </animated.mesh>
    </>
  );
}
