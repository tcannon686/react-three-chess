import React, { Suspense, useMemo, useState } from 'react'
import { Canvas, useLoader } from 'react-three-fiber'
import { a, useSpring } from 'react-spring/three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PlaneGeometry, BufferGeometry } from 'three'

import { ChessCamera } from './camera'
import { makeGame, movePiece } from './chess'

/** A chess board. */
function Board (props) {
  const colors = props.colors
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const materials = useMemo(() => colors.map(color => (
    <meshStandardMaterial
      key={color}
      color={color}
      metalness={0.0}
      roughness={0.2}
    />
  )), [colors])
  const meshes = []
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      meshes.push(
        <mesh
          key={i + j * 8}
          geometry={geometry}
          rotation-x={-Math.PI / 2}
          position={[i, 0, j]}
        >
          {materials[(i + j) % 2]}
        </mesh>
      )
    }
  }
  return (
    <group {...props}>
      {meshes}
    </group>
  )
}

/**
 * A clickable slot on the chessboard.
 *
 * Props:
 *  - coord - the position on the board
 */
function Slot (props) {
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  return (
    <mesh
      {...props}
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

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)

  const { x, z } = useSpring({ x: piece.coord[0], z: piece.coord[1] })

  return (
    <a.mesh
      {...meshProps}
      position-x={x}
      position-y={0}
      position-z={z}
      rotation-y={piece.color === 'black' ? 0 : Math.PI}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
      onClick={!disabled && onClick}
    >
      <meshStandardMaterial
        color={
              active
                ? 'orange'
                : (!disabled && hovered ? 'hotpink' : piece.color)
            }
        metalness={0.0}
        roughness={0.2}
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

  const onMovePiece = (newPiece) => {
    setGame(movePiece(game, newPiece))

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
        <Board colors={['black', 'white']} />
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
            onChange={(newPiece) => onMovePiece(newPiece)}
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
