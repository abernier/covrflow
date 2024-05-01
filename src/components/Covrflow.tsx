import {
  ComponentProps,
  ElementRef,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from "react";
import { Box } from "@react-three/drei";
import { useControls } from "leva";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

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

  return (
    <>
      {!debugOnly && (
        <Box
          castShadow
          receiveShadow
          ref={ref}
          args={[3, 5, 0.1]}
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
        <Box args={[3, 5, 0.1]} {...posRot} {...props}>
          <meshStandardMaterial wireframe color="#aaa" />
        </Box>
      )}
    </>
  );
});

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
        { opacity: STATES.backleft.opacity },
        {
          opacity: STATES.left.opacity,
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
        { opacity: STATES.right.opacity },
        {
          opacity: STATES.backright.opacity,
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
    <group position={[0, 2.5, 0]}>
      <Panel ref={panel1Ref} state="backleft" debug />
      <Panel ref={panel2Ref} state="left" debug />
      <Panel ref={panel3Ref} state="front" debug />
      <Panel ref={panel4Ref} state="right" debug />

      <Panel state="backright" debug debugOnly />
    </group>
  );
});
