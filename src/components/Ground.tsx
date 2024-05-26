import { RigidBody } from "@react-three/rapier";

function Ground() {
  const w = 100;
  const h = 0.1;
  const d = 100;
  return (
    <RigidBody type="fixed" position-y={-h / 2}>
      <mesh receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color="gray"
          // transparent opacity={0.8}
        />
      </mesh>
    </RigidBody>
  );
}

export default Ground;
