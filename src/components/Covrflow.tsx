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
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/three";

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

function adjustToTimeline(x: number) {
  //
  // Fonction pour ajuster x dans l'intervalle [0, 1]
  //
  // https://chat.openai.com/share/743ba98b-a8b0-488b-af0c-0aac705233d3
  //

  x = x % 1; // Utilisation du modulo pour limiter x entre -1 et 1
  if (x < 0) x += 1; // Ajustement pour que x soit toujours positif
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
  const defaultColor = "#ccc";
  const [color, setColor] = useState(defaultColor);

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
          receiveShadow
          ref={ref}
          args={size}
          {...posRot}
          {...props}
          onPointerEnter={() => {
            setColor("white");
          }}
          onPointerLeave={() => {
            setColor(defaultColor);
          }}
        >
          {children || (
            <meshStandardMaterial transparent opacity={1} color={color} />
          )}
        </Box>
      )}

      {debug && (
        <Box args={size} {...posRot} {...props}>
          <meshStandardMaterial
            wireframe
            color="#aaa"
            // opacity={0.25}
            // transparent
          />
        </Box>
      )}
    </>
  );
});

function Scroller({ setSeek }: { setSeek: (val: number) => void }) {
  const defaultSpring = { mass: 1, tension: 800 };
  const [springs, api] = useSpring(() => ({
    position: [0, 0, 0],
    config: {
      mass: defaultSpring.mass,
      friction: 40,
      tension: defaultSpring.tension,
    },
    onChange: ({
      value: {
        position: [x, y, z],
      },
    }) => {
      console.log(x);
      setSeek(x);
    },
  }));
  const bind = useDrag(({ event, movement: [mx], offset: [ox], down }) => {
    event.stopPropagation();

    const dx = (1 / 20) * mx;

    api.start({
      position: down ? [dx, 0, 0] : [0, 0, 0],
      config: {
        mass: down ? defaultSpring.mass : 4,
        tension: down ? 2000 : defaultSpring.tension,
      },
    });
  });

  const r = 0.3;
  return (
    <>
      <group position={[0, r, 10]}>
        <animated.mesh
          position={springs.position.to((x, y, z) => [x, y, z])}
          {...(bind() as any)}
          castShadow
        >
          <sphereGeometry args={[r, 64, 64]} />
          <meshNormalMaterial />
        </animated.mesh>
      </group>
    </>
  );
}

//  ██████  ██████  ██    ██ ██████  ███████ ██       ██████  ██     ██
// ██      ██    ██ ██    ██ ██   ██ ██      ██      ██    ██ ██     ██
// ██      ██    ██ ██    ██ ██████  █████   ██      ██    ██ ██  █  ██
// ██      ██    ██  ██  ██  ██   ██ ██      ██      ██    ██ ██ ███ ██
//  ██████  ██████    ████   ██   ██ ██      ███████  ██████   ███ ███

export const Covrflow = forwardRef<
  ElementRef<"group">,
  ComponentProps<"group">
>((props, ref) => {
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
    },
    { dependencies: [tl] }
  );

  //
  // GUI
  //

  const [gui, setGui] = useControls(() => ({
    seek: {
      value: 0,
      min: -19.9,
      max: 29.9,
      step: 0.001,
    },
    debug: true,
  }));

  const seek = gui.seek;
  const setSeek = useCallback((seek: number) => setGui({ seek }), [setGui]);

  useEffect(() => {
    tl.seek(adjustToTimeline(seek));
  }, [tl, seek]);

  const debug = gui.debug;
  return (
    <>
      <group position={[0, 2.5 + 0.01, 0]}>
        <Panel ref={panel1Ref} state="backleft" debug={debug}>
          <meshStandardMaterial color={circular(Math.floor(seek) - 0 + 2)} />
        </Panel>
        <Panel ref={panel2Ref} state="left" debug={debug}>
          <meshStandardMaterial color={circular(Math.floor(seek) - 1 + 2)} />
        </Panel>
        <Panel ref={panel3Ref} state="front" debug={debug}>
          <meshStandardMaterial color={circular(Math.floor(seek) - 2 + 2)} />
        </Panel>
        <Panel ref={panel4Ref} state="right" debug={debug}>
          <meshStandardMaterial color={circular(Math.floor(seek) - 3 + 2)} />
        </Panel>

        <Panel state="backright" debug={debug} debugOnly />
      </group>

      <Scroller setSeek={setSeek} />
    </>
  );
});
