import React, { Suspense, useMemo, useState } from 'react'
import { Canvas, useLoader } from 'react-three-fiber'
import { a, useSpring, useTransition } from 'react-spring/three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PlaneGeometry, BufferGeometry } from 'three'

import { ChessCamera } from './camera'
import { makeGame, movePiece, getValidMoves } from './chess'

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
    <a.mesh
      {...props}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
    >
      <boxBufferGeometry args={[0.75, 0.1, 0.75]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </a.mesh>
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
 *  - game - the current game state
 *  - onChange (piece) - A callback function called with the modified piece
 */
function PieceMover (props) {
  const {
    piece,
    game,
    onChange
  } = props

  const transitions = useTransition(
    getValidMoves(game, piece),
    null,
    {
      config: {
        tension: 400,
        mass: 1.5
      },
      trail: 25,
      from: { scale: [0, 0, 0] },
      enter: { scale: [1, 1, 1] },
      leave: { scale: [0, 0, 0] }
    }
  )

  return (
    <>
      {transitions.map(({ item, key, props }) => (
        <Slot
          {...props}
          key={key}
          coord={item}
          onClick={() => onChange({
            ...piece,
            coord: item,
            hasMoved: true
          })}
          position={[item[0], 0.05, item[1]]}
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
            game={game}
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
