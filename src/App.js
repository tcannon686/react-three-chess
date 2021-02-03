import React, { Suspense, useMemo, useState, useRef } from 'react'
import { Canvas, useLoader, useFrame } from 'react-three-fiber'
import { a, useSpring, useTransition } from 'react-spring/three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PlaneGeometry, BufferGeometry } from 'three'

import { ChessCamera } from './camera'
import {
  makeGame,
  updatePiece,
  getValidMoves,
  getPieceAtPosition,
  canPromote,
  canMove,
  isInCheck,
  PIECE_NAMES
} from './chess'

/** A chess board. */
function Board (props) {
  const colors = props.colors
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const materials = useMemo(() => colors.map(color => (
    <meshStandardMaterial
      key={color}
      color={color}
      metalness={0.0}
      roughness={0.3}
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
  const {
    attack,
    ...meshProps
  } = props
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)
  const color = attack
    ? (hovered ? 'red' : 'orangered')
    : (hovered ? 'hotpink' : 'orange')

  return (
    <a.mesh
      {...meshProps}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
    >
      <boxBufferGeometry args={[0.75, 0.1, 0.75]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
      />
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
        color={piece.color}
        emissive={
          active
            ? 'orange'
            : (!disabled && hovered ? 'hotpink' : '#000000')
        }
        metalness={0.0}
        roughness={0.3}
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
 *  - onUpdate (piece) - A callback function called with the modified piece
 */
function PieceMover (props) {
  const {
    piece,
    game,
    onUpdate
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
          onClick={() => onUpdate({
            ...piece,
            coord: item,
            moveCount: piece.moveCount + 1
          })}
          position={[item[0], 0.05, item[1]]}
          attack={(x => x && x.color !== piece.color)(
            getPieceAtPosition(game, ...item)
          )}
        />
      ))}
    </>
  )
}

function useGeometries () {
  const models = useLoader(
    GLTFLoader,
    PIECE_NAMES.map((x) => `models/${x}.glb`))
  return useMemo(() => {
    const ret = {}
    PIECE_NAMES.forEach((x, i) => {
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
  }, [models])
}

function PromoteMenuPiece (props) {
  const {
    piece,
    ...meshProps
  } = props
  const mesh = useRef()

  const [hovered, setHover] = useState(false)

  useFrame((state, delta) => {
    if (mesh.current !== null) {
      mesh.current.rotation.y += delta
    }
  })

  return (
    <a.mesh
      ref={mesh}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      {...meshProps}
    >
      <meshStandardMaterial
        color={piece.color}
        metalness={0.0}
        roughness={0.3}
        emissive={hovered ? 'hotpink' : '#000000'}
        opacity={0.9}
        transparent
      />
    </a.mesh>
  )
}

function PromoteMenu (props) {
  const {
    game,
    piece,
    onUpdate
  } = props

  const geometries = useGeometries()
  const types = (
    piece && canPromote(game, piece)
      ? ['queen', 'knight', 'bishop', 'rook']
      : []
  )

  const transitions = useTransition(
    types.map((type, i) => ({
      piece,
      type,
      position: [
        piece.coord[0] + (i - types.length / 2) + 0.5,
        1,
        piece.coord[1]
      ]
    })),
    item => piece.id + ',' + item.type,
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
        <PromoteMenuPiece
          {...props}
          piece={item.piece}
          key={key}
          geometry={geometries[item.type]}
          position={item.position}
          onClick={() => onUpdate({
            ...item.piece,
            type: item.type
          })}
        />
      ))}
    </>
  )
}

function Game () {
  const [game, setGame] = useState(makeGame())

  const geometries = useGeometries()

  /* The index in the pieces array of the currently selected piece. */
  const [activePiece, setActivePiece] = useState()

  const turn = game.moveCount % 2 ? 'black' : 'white'

  const gameOver = canMove(game, turn)

  const onUpdate = (newPiece) => {
    setGame(updatePiece(game, newPiece))

    /* Deselect the piece. */
    setActivePiece(undefined)
  }

  return (
    <>
      {!gameOver
        ? (
          <Canvas>
            <ChessCamera turn={turn} />
            <ambientLight intensity={0.05} />
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
                  onUpdate={onUpdate}
                />
              )}
              <PromoteMenu
                game={game}
                piece={activePiece}
                onUpdate={onUpdate}
              />
            </group>
          </Canvas>
          )
        : (
          <p>
            {
                (isInCheck(game, turn) ? 'Checkmate: ' : 'Stalemate: ') +
                turn + ' loses!'
              }
          </p>
          )}
    </>
  )
}

function App () {
  return (
    <Suspense fallback={<p> Loading... </p>}>
      <Game />
    </Suspense>
  )
}

export default App
