import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame, useLoader } from 'react-three-fiber'
import { a, animated, useSpring } from 'react-spring/three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometry } from 'three'

/** Camera. */
function Camera (props) {
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
function LookAt (props) {
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
function Orbiter (props) {
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

const AnimatedOrbiter = animated(Orbiter)

function ChessCamera (props) {
  const {
    turn,
    ...cameraProps
  } = props

  const targetAngle = turn === 'black' ? 0 : Math.PI

  const { angleX } = useSpring({
    angleX: targetAngle,
    delay: 1000
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

/**
 * A clickable slot on the chessboard.
 *
 * Props:
 *  - coord - the position on the board
 */
function Slot (props) {
  const mesh = useRef()

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  return (
    <mesh
      {...props}
      ref={mesh}
      position={[props.coord[0], 0, props.coord[1]]}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
    >
      <boxBufferGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

/**
 * A chess piece.
 *
 * Props:
 *  - active
 *  - piece
 *  - disabled
 *  - onClick
 */
function Piece (props) {
  const {
    active,
    piece,
    disabled,
    onClick,
    ...meshProps
  } = props

  // This reference will give us direct access to the mesh
  const mesh = useRef()

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  const { x, z } = useSpring({ x: piece.coord[0], z: piece.coord[1] })

  return (
    <a.mesh
      {...meshProps}
      ref={mesh}
      position-x={x}
      position-y={0}
      position-z={z}
      rotation-y={piece.color === 'black' ? 0 : Math.PI}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
      onClick={!disabled && onClick}
    >
      <meshStandardMaterial color={
        active
          ? 'orange'
          : (!disabled && hovered ? 'hotpink' : piece.color)
      }
      />
    </a.mesh>
  )
}

/**
 * A component for moving a piece on the board.
 *
 * This component allows the user to select where to move a piece based on the
 * piece's type.
 *
 * Props:
 *  - piece - the piece to be moved
 *  - onChange (piece) - A callback function called with the modified piece
 */
function PieceMover (props) {
  const {
    piece,
    pieces,
    onChange
  } = props

  let possibleCoords = []

  const direction = piece.color === 'white' ? 1 : -1

  const getPieceAtPosition = (x, y) => (
    pieces.filter(p => p.coord[0] === x && p.coord[1] === y)[0]
  )

  /*
   * Creates a place to attack at the given position if possible. Returns true
   * if possible, false if not in bounds or if the position would hit a friendly
   * piece.
   */
  const makeAttack = (x, y) => {
    /* Find any pieces at the position. */
    const hitPiece = getPieceAtPosition(x, y)
    const inBounds = x >= 0 && y >= 0 && x < 8 && y < 8
    const hittingFriendly = (hitPiece && hitPiece.color === piece.color)
    if (inBounds && !hittingFriendly) {
      possibleCoords.push([x, y])
      return true
    }
    return false
  }

  /*
   * Creates an attack with count directions, starting at the given offset in
   * radians.
   */
  const makeAngleAttack = (count, offset = 0, max = Infinity) => {
    possibleCoords = []
    for (let i = 0; i < count; i++) {
      const dx = Math.sign(Math.round(Math.cos(i * 2 * Math.PI / count + offset)))
      const dy = Math.sign(Math.round(Math.sin(i * 2 * Math.PI / count + offset)))
      let [x, y] = piece.coord

      let hitPieceCount = 0
      for (let j = 0; j < max; j++) {
        x += dx
        y += dy

        /* You can only hit one piece. */
        hitPieceCount += pieces
          .filter(p => p.coord[0] === x && p.coord[1] === y)
          .length

        if (!makeAttack(x, y)) {
          break
        }

        /* Stop iterating if we hit a piece. */
        if (hitPieceCount > 0) {
          break
        }
      }
    }
  }

  if (piece.type === 'pawn') {
    makeAttack(piece.coord[0], piece.coord[1] + direction)

    const left = [piece.coord[0] - 1, piece.coord[1] + direction]
    const right = [piece.coord[0] + 1, piece.coord[1] + direction]

    const leftPiece = getPieceAtPosition(...left)
    const rightPiece = getPieceAtPosition(...right)

    if (leftPiece && leftPiece.color !== piece.color) {
      makeAttack(...left)
    }
    if (rightPiece && rightPiece.color !== piece.color) {
      makeAttack(...right)
    }
  } else if (piece.type === 'queen') {
    makeAngleAttack(10)
  } else if (piece.type === 'rook') {
    makeAngleAttack(4)
  } else if (piece.type === 'bishop') {
    makeAngleAttack(4, Math.PI / 4)
  } else if (piece.type === 'king') {
    makeAngleAttack(10, 0, 1)
  } else if (piece.type === 'knight') {
    [[1, 2], [2, 1]].forEach((pair) => {
      makeAttack(piece.coord[0] + pair[0], piece.coord[1] + pair[1])
      makeAttack(piece.coord[0] - pair[0], piece.coord[1] + pair[1])
      makeAttack(piece.coord[0] + pair[0], piece.coord[1] - pair[1])
      makeAttack(piece.coord[0] - pair[0], piece.coord[1] - pair[1])
    })
  }

  return (
    <>
      {possibleCoords.map((coord, i) => (
        <Slot
          key={i}
          coord={coord}
          onClick={() => onChange({
            ...piece,
            coord
          })}
        />
      ))}
    </>
  )
}

/**
 * Helper function to create the pieces on the board.
 */
function createPieces () {
  /* Basic chessboard layout. */
  const board = [
    'R', 'k', 'B', 'Q', 'K', 'B', 'k', 'R',
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    'R', 'k', 'B', 'Q', 'K', 'B', 'k', 'R'
  ]

  const shortToType = {
    R: 'rook',
    k: 'knight',
    P: 'pawn',
    K: 'king',
    B: 'bishop',
    Q: 'queen'
  }

  /* Create the pieces. */
  return board.map((t, i) => ({
    id: i,
    type: shortToType[t],
    color: Math.floor(i / 8) > 4 ? 'black' : 'white',
    coord: [i % 8, Math.floor(i / 8)]
  })).filter((x) => x.type)
}

/** Creates a new game (match). */
function makeGame () {
  return {
    pieces: createPieces(),
    moveCount: 0
  }
}

/**
 * Moves a piece on the board and returns the new game state. The moveCount for
 * the game is incremented by moveCount, which is default 1.
 */
function movePiece (game, oldPiece, newPiece, moveCount = 1) {
  const pieces = game.pieces.filter(x => (
    (x.coord[0] !== newPiece.coord[0] ||
      x.coord[1] !== newPiece.coord[1]) &&
    x !== oldPiece
  ))
  pieces.push(newPiece)

  return {
    ...game,
    pieces,
    moveCount: game.moveCount + moveCount
  }
}

function useGeometries () {
  const pieces = useMemo(() => [
    'bishop',
    'king',
    'knight',
    'pawn',
    'queen',
    'rook'
  ], [])
  const models = useLoader(
    GLTFLoader,
    pieces.map((x) => `models/${x}.glb`))
  return useMemo(() => {
    const ret = {}
    pieces.forEach((x, i) => {
      const geometry = new BufferGeometry()

      const geometries = []
      models[i].scene.traverse((object) => {
        if (object.geometry) {
          geometries.push(object.geometry)
        }
      })
      geometry.copy(BufferGeometryUtils.mergeBufferGeometries(geometries))

      ret[x] = geometry
    })
    return ret
  }, [models, pieces])
}

function Game () {
  const [game, setGame] = useState(makeGame())

  const geometries = useGeometries()

  /* The index in the pieces array of the currently selected piece. */
  const [activePiece, setActivePiece] = useState()

  const turn = game.moveCount % 2 ? 'black' : 'white'

  const onMovePiece = (oldPiece, newPiece) => {
    setGame(movePiece(game, oldPiece, newPiece))

    /* Deselect the piece. */
    setActivePiece(undefined)
  }

  return (
    <>
      <ChessCamera turn={turn} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 10, 0]} />
      <group
        position={[-3.5, 0, -3.5]}
      >
        {game.pieces.map((piece, i) => (
          <Piece
            key={piece.id}
            geometry={geometries[piece.type]}
            game={game}
            piece={piece}
            onClick={() => setActivePiece(piece)}
            active={piece === activePiece}
            disabled={turn !== piece.color}
          />
        ))}
        {activePiece !== undefined && (
          <PieceMover
            pieces={game.pieces}
            piece={activePiece}
            onChange={(newPiece) => onMovePiece(activePiece, newPiece)}
          />
        )}
      </group>
    </>
  )
}

function App () {
  return (
    <Canvas>
      <Suspense fallback={<group />}>
        <Game />
      </Suspense>
    </Canvas>
  )
}

export default App
