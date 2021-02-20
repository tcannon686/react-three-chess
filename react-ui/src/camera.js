import { useThree, useFrame } from 'react-three-fiber'
import React, { useRef, useEffect } from 'react'
import { animated, useSpring } from 'react-spring/three'

/** Camera. */
export function Camera (props) {
  const ref = useRef()
  const { setDefaultCamera } = useThree()
  // Make the camera known to the system
  useEffect(() => setDefaultCamera(ref.current), [setDefaultCamera])
  // Update it every frame
  useFrame(() => ref.current.updateMatrixWorld())
  return <perspectiveCamera ref={ref} {...props} />
}

/**
 * A component that looks at a target in world space.
 *
 * Props:
 *  - children
 *  - target - An array of 3 numbers representing the target in world space
 */
export function LookAt (props) {
  const {
    children,
    target,
    ...rest
  } = props

  const ref = useRef()
  useFrame(() => {
    ref.current.lookAt(...target)
  })

  return (
    <group ref={ref} {...rest}>
      {children}
    </group>
  )
}

/**
 * A component that rotates around a target.
 *
 * Props:
 *  - children
 *  - target - An array of 3 numbers representing the target in world space
 *  - angleX - The angle around the target
 *  - angleY - The vertical angle around the target
 */
export function Orbiter (props) {
  const {
    children,
    target,
    angleX,
    angleY,
    distance
  } = props

  return (
    <LookAt
      target={target}
      position={[
        target[0] + Math.sin(angleX || 0) * distance,
        target[1] + Math.sin(angleY || 0) * distance,
        target[2] + Math.cos(angleX || 0) * distance
      ]}
    >
      {children}
    </LookAt>
  )
}

export const AnimatedOrbiter = animated(Orbiter)

/**
 * Camera and controller for chess game.
 *
 * Props:
 *  - turn - What colors turn it is, either black or white.
 */
export function ChessCamera (props) {
  const {
    turn,
    ...cameraProps
  } = props

  const targetAngle = turn === 'black' ? 0 : Math.PI

  const { angleX } = useSpring({
    angleX: targetAngle
  })

  return (
    <AnimatedOrbiter
      target={[0, 0, 0]}
      angleX={angleX || targetAngle}
      angleY={Math.PI / 4}
      distance={7}
    >
      <Camera rotation={[0, Math.PI, 0]} {...cameraProps} />
    </AnimatedOrbiter>
  )
}
